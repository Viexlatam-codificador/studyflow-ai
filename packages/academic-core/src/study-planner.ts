import type {
  AvailabilityBlock,
  AvailabilityException,
  AvailabilitySettings,
  ExplanationMethod,
  PlanItemOrigin,
  SessionMethod,
  StudyPlanItem,
  TaskStatus,
} from "@studyflow/shared";
import { calculatePriorityScore } from "./priority-engine";
import { addDaysToDateStr, toDateStr, utcToZonedParts, zonedTimeToUtc } from "./zoned-time";

/**
 * The free, no-AI weekly planning engine (master spec section 5). Pure
 * functions only — no Supabase client, no fetch, no Date.now() side
 * effects (every "now" is passed in), so it is fully unit-testable and
 * works identically whether or not any AI provider is configured.
 */

export interface PlannableTask {
  id: string;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  gradeWeight: number | null;
  difficulty: number | null;
  progressPercentage: number;
  status: TaskStatus;
}

/** A previously-scheduled item that must be preserved as-is: either
 * already completed, or explicitly pinned by the student. The engine
 * treats the time it occupies as unavailable and never re-emits it as a
 * *new* item — the caller is expected to keep it in the final list. */
export interface FixedPlanItem {
  id: string;
  taskId: string | null;
  startsAt: string;
  endsAt: string;
}

export interface StudyPlannerProfile {
  sessionDurationMinutes: number | null;
  explanationMethods: ExplanationMethod[];
}

/** taskId -> content Gemini suggested (section 7). The engine still
 * decides *where* (and whether) each task's sessions land — this only
 * changes the objective/method text and estimate used for that task. */
export type GeminiTaskContent = Record<string, { objective: string; method: SessionMethod; estimatedMinutes: number }>;

export interface GenerateWeeklyPlanInput {
  now: Date;
  timezone: string;
  tasks: PlannableTask[];
  availabilityBlocks: AvailabilityBlock[];
  availabilityExceptions: AvailabilityException[];
  settings: AvailabilitySettings;
  profile: StudyPlannerProfile;
  /** subjectId -> confidence 1..5, only for subjects with a *declared*
   * value — missing means "evidencia todavía insuficiente", never assumed. */
  subjectConfidence: Record<string, number>;
  fixedItems: FixedPlanItem[];
  geminiContent?: GeminiTaskContent;
  /** How many days ahead to plan — section 5 asks for "los próximos siete
   * días" but tests want to probe shorter horizons deterministically. */
  horizonDays?: number;
}

export interface UnassignedWork {
  taskId: string;
  title: string;
  minutesUnassigned: number;
}

export interface GenerateWeeklyPlanResult {
  weekStart: string;
  items: Omit<StudyPlanItem, "id" | "studyPlanId" | "status" | "isFixed">[];
  unassignedMinutes: number;
  unassignedByTask: UnassignedWork[];
}

interface DayWindow {
  dateStr: string;
  startsAt: Date;
  endsAt: Date;
}

const DEFAULT_ESTIMATE_MINUTES = 30;
const DEFAULT_SESSION_CHUNK_MINUTES = 45;
const MIN_CHUNK_MINUTES = 10; // don't emit sessions shorter than this — not actionable
const METHOD_CYCLE: SessionMethod[] = ["steps", "exercises", "questions"];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Turns recurring blocks + one-off exceptions + the daily cap into concrete
 * per-day STUDY_WINDOW intervals for the next `horizonDays` days, already
 * net of CLASS/WORK/OTHER busy time and any already-fixed items.
 * "No interpretes toda hora vacía como tiempo libre" — only STUDY_WINDOW
 * blocks (plus EXTRA_AVAILABLE exceptions) ever produce free time here.
 */
export function computeAvailableWindows(
  now: Date,
  timezone: string,
  blocks: AvailabilityBlock[],
  exceptions: AvailabilityException[],
  settings: AvailabilitySettings,
  fixedItems: FixedPlanItem[],
  horizonDays: number
): DayWindow[] {
  const todayStr = utcToZonedParts(now, timezone).dateStr;
  const days: DayWindow[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const dateStr = addDaysToDateStr(todayStr, i);
    const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();

    const exceptionsToday = exceptions.filter((e) => e.exceptionDate === dateStr);
    const fullDayBlocked = exceptionsToday.some((e) => e.kind === "UNAVAILABLE" && !e.startTime && !e.endTime);
    if (fullDayBlocked) continue;

    let intervals: { start: Date; end: Date }[] = blocks
      .filter((b) => b.kind === "STUDY_WINDOW" && b.dayOfWeek === dayOfWeek)
      .map((b) => ({
        start: zonedTimeToUtc(dateStr, b.startTime, timezone),
        end: zonedTimeToUtc(dateStr, b.endTime, timezone),
      }));

    for (const exc of exceptionsToday) {
      if (exc.kind === "EXTRA_AVAILABLE" && exc.startTime && exc.endTime) {
        intervals.push({
          start: zonedTimeToUtc(dateStr, exc.startTime, timezone),
          end: zonedTimeToUtc(dateStr, exc.endTime, timezone),
        });
      }
    }

    const busy: { start: Date; end: Date }[] = blocks
      .filter((b) => b.kind !== "STUDY_WINDOW" && b.dayOfWeek === dayOfWeek)
      .map((b) => ({
        start: zonedTimeToUtc(dateStr, b.startTime, timezone),
        end: zonedTimeToUtc(dateStr, b.endTime, timezone),
      }))
      .concat(
        exceptionsToday
          .filter((e) => e.kind === "UNAVAILABLE" && e.startTime && e.endTime)
          .map((e) => ({
            start: zonedTimeToUtc(dateStr, e.startTime!, timezone),
            end: zonedTimeToUtc(dateStr, e.endTime!, timezone),
          }))
      )
      .concat(fixedItems.map((f) => ({ start: new Date(f.startsAt), end: new Date(f.endsAt) })));

    for (const b of busy) intervals = subtractInterval(intervals, b);

    intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

    let minutesUsedToday = 0;
    for (const interval of intervals) {
      if (interval.end <= now) continue; // past — never schedule in the past
      const start = interval.start < now ? now : interval.start;
      const availableMinutes = Math.max(0, (interval.end.getTime() - start.getTime()) / 60_000);
      if (availableMinutes < MIN_CHUNK_MINUTES) continue;

      const remainingCap = settings.maxDailyMinutes - minutesUsedToday;
      if (remainingCap < MIN_CHUNK_MINUTES) break;

      const usableMinutes = Math.min(availableMinutes, remainingCap);
      const end = new Date(start.getTime() + usableMinutes * 60_000);
      days.push({ dateStr, startsAt: start, endsAt: end });
      minutesUsedToday += usableMinutes;
    }
  }

  return days;
}

function subtractInterval(
  intervals: { start: Date; end: Date }[],
  busy: { start: Date; end: Date }
): { start: Date; end: Date }[] {
  const result: { start: Date; end: Date }[] = [];
  for (const iv of intervals) {
    if (busy.end <= iv.start || busy.start >= iv.end) {
      result.push(iv);
      continue;
    }
    if (busy.start > iv.start) result.push({ start: iv.start, end: new Date(Math.min(busy.start.getTime(), iv.end.getTime())) });
    if (busy.end < iv.end) result.push({ start: new Date(Math.max(busy.end.getTime(), iv.start.getTime())), end: iv.end });
  }
  return result.filter((iv) => iv.end.getTime() - iv.start.getTime() >= 60_000);
}

interface TaskPlanState {
  task: PlannableTask;
  score: number;
  remainingMinutes: number;
  sessionsScheduled: number;
  daysUsed: Set<string>;
}

function confidenceAdjustedScore(task: PlannableTask, subjectConfidence: Record<string, number>, now: Date): number {
  const base = calculatePriorityScore(
    {
      dueAt: task.dueAt,
      estimatedMinutes: task.estimatedMinutes,
      gradeWeight: task.gradeWeight,
      difficulty: task.difficulty,
      progressPercentage: task.progressPercentage,
    },
    now
  );
  const confidence = task.subjectId ? subjectConfidence[task.subjectId] : undefined;
  if (confidence === undefined) return base;
  // Documented, bounded nudge: low declared confidence -> study it a bit
  // sooner; high confidence -> slight deference to weaker subjects. Never
  // more than +/-5 points, so it can never invert an urgent deadline.
  if (confidence <= 2) return clamp(base + 5, 0, 100);
  if (confidence >= 4) return clamp(base - 5, 0, 100);
  return base;
}

/** Picks the next explanation method for a task's Nth session, cycling
 * through the student's declared preferences (or a sane default sequence)
 * so a multi-session task mixes explanation, practice and recall instead
 * of repeating the same method every time (section 5, "combinar..."). */
function methodForSession(index: number, preferred: ExplanationMethod[]): SessionMethod {
  const usable = preferred.filter((m): m is SessionMethod => m !== "diagrams" && m !== "mixed");
  const cycle = usable.length > 0 ? usable : METHOD_CYCLE;
  return cycle[index % cycle.length] as SessionMethod;
}

function buildObjective(task: PlannableTask, sessionIndex: number, totalSessions: number, method: SessionMethod, hadKnownEstimate: boolean): string {
  const label = totalSessions > 1 ? `Parte ${sessionIndex + 1}/${totalSessions} — ` : "";
  const suffix = hadKnownEstimate ? "" : " (estimación editable — no tenías una duración registrada)";
  const methodPhrase: Record<SessionMethod, string> = {
    examples: "revisar ejemplos resueltos de",
    steps: "avanzar paso a paso en",
    diagrams: "esquematizar",
    exercises: "practicar ejercicios de",
    questions: "responder preguntas de repaso de",
    mixed: "avanzar en",
  };
  return `${label}${methodPhrase[method]} "${task.title}"${suffix}`;
}

function buildPriorityReason(task: PlannableTask, now: Date): string {
  const parts: string[] = [];
  if (task.dueAt) {
    const days = Math.ceil((new Date(task.dueAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) parts.push("vence hoy o ya venció");
    else if (days === 1) parts.push("vence mañana");
    else parts.push(`vence en ${days} días`);
  } else {
    parts.push("sin fecha límite registrada");
  }
  if (task.gradeWeight) parts.push(`vale ${task.gradeWeight}% de la nota`);
  if (task.progressPercentage > 0) parts.push(`llevas ${task.progressPercentage}% de avance`);
  return parts.join(" · ");
}

/**
 * Generates the next `horizonDays` (default 7) of study sessions. Never
 * throws for "impossible" load — instead reports it via `unassignedMinutes`
 * / `unassignedByTask` (section 5, "no convertir un dato ausente en una
 * certeza ... mostrar cuánto trabajo queda sin asignar").
 */
export function generateWeeklyPlan(input: GenerateWeeklyPlanInput): GenerateWeeklyPlanResult {
  const horizonDays = input.horizonDays ?? 7;
  const todayStr = utcToZonedParts(input.now, input.timezone).dateStr;

  const actionable = input.tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");

  const states: TaskPlanState[] = actionable.map((task) => {
    const hadKnownEstimate = task.estimatedMinutes !== null && task.estimatedMinutes > 0;
    const gemini = input.geminiContent?.[task.id];
    const totalMinutes = gemini?.estimatedMinutes ?? (hadKnownEstimate ? task.estimatedMinutes! : DEFAULT_ESTIMATE_MINUTES);
    return {
      task,
      score: confidenceAdjustedScore(task, input.subjectConfidence, input.now),
      remainingMinutes: totalMinutes,
      sessionsScheduled: 0,
      daysUsed: new Set<string>(),
    };
  });
  states.sort((a, b) => b.score - a.score);

  const windows = computeAvailableWindows(
    input.now,
    input.timezone,
    input.availabilityBlocks,
    input.availabilityExceptions,
    input.settings,
    input.fixedItems,
    horizonDays
  ).map((w) => ({ ...w, remainingMs: w.endsAt.getTime() - w.startsAt.getTime(), cursor: w.startsAt, continuousMs: 0 }));

  const breakEveryMs = Math.max(1, input.settings.breakEveryMinutes) * 60_000;
  const breakMs = Math.max(0, input.settings.breakMinutes) * 60_000;

  const chunkTarget = input.profile.sessionDurationMinutes ?? DEFAULT_SESSION_CHUNK_MINUTES;
  const items: Omit<StudyPlanItem, "id" | "studyPlanId" | "status" | "isFixed">[] = [];

  // Two passes: first give every task with remaining minutes a shot at the
  // earliest day *before its due date*; a second pass fills any slack with
  // whatever tasks still have remaining minutes, on any day in the horizon.
  // This is what makes "programar antes de la fecha límite cuando sea
  // viable" hold without starving lower-priority tasks of leftover room.
  for (const preferOwnDay of [true, false]) {
    for (const state of states) {
      if (state.remainingMinutes <= 0) continue;
      const dueDateStr = state.task.dueAt ? utcToZonedParts(new Date(state.task.dueAt), input.timezone).dateStr : null;

      for (const window of windows) {
        if (state.remainingMinutes <= 0) break;
        if (window.remainingMs / 60_000 < MIN_CHUNK_MINUTES) continue;
        if (dueDateStr && window.dateStr > dueDateStr) continue;
        if (preferOwnDay && state.daysUsed.has(window.dateStr) && windows.some((w) => w !== window && w.remainingMs / 60_000 >= MIN_CHUNK_MINUTES && (!dueDateStr || w.dateStr <= dueDateStr) && !state.daysUsed.has(w.dateStr))) {
          continue; // spread across distinct days while another day still has room
        }

        const chunk = clamp(Math.min(chunkTarget, state.remainingMinutes), MIN_CHUNK_MINUTES, window.remainingMs / 60_000);
        if (chunk < MIN_CHUNK_MINUTES) continue;

        const startsAt = window.cursor;
        const endsAt = new Date(startsAt.getTime() + chunk * 60_000);
        const gemini = input.geminiContent?.[state.task.id];
        const method: SessionMethod = gemini?.method ?? methodForSession(state.sessionsScheduled, input.profile.explanationMethods);
        const hadKnownEstimate = state.task.estimatedMinutes !== null && state.task.estimatedMinutes > 0;

        items.push({
          taskId: state.task.id,
          subjectId: state.task.subjectId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          objective: gemini?.objective ?? buildObjective(state.task, state.sessionsScheduled, Math.ceil((state.remainingMinutes) / chunkTarget) + state.sessionsScheduled, method, hadKnownEstimate),
          method,
          expectedResult: `Avanzar ~${Math.round(chunk)} min en "${state.task.title}" y dejar anotado qué falta.`,
          priorityReason: buildPriorityReason(state.task, input.now),
          origin: (gemini ? "GEMINI" : "ENGINE") as PlanItemOrigin,
        });

        state.remainingMinutes -= chunk;
        state.sessionsScheduled += 1;
        state.daysUsed.add(window.dateStr);
        window.cursor = endsAt;
        window.continuousMs += chunk * 60_000;

        // Reserve a break inside the window once accumulated work crosses
        // the threshold (section 5, "reservar pausas dentro de las
        // ventanas") — only if there's still room left; otherwise the
        // window just ends and the break is implicitly whatever gap comes
        // before the next declared STUDY_WINDOW.
        if (window.continuousMs >= breakEveryMs && breakMs > 0) {
          const afterBreak = new Date(window.cursor.getTime() + breakMs);
          if (afterBreak < window.endsAt) {
            window.cursor = afterBreak;
          } else {
            window.cursor = window.endsAt; // not enough room for the break — just close out the window
          }
          window.continuousMs = 0;
        }

        window.remainingMs = window.endsAt.getTime() - window.cursor.getTime();
      }
    }
  }

  items.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const unassignedByTask: UnassignedWork[] = states
    .filter((s) => s.remainingMinutes > 0)
    .map((s) => ({ taskId: s.task.id, title: s.task.title, minutesUnassigned: Math.round(s.remainingMinutes) }));
  const unassignedMinutes = unassignedByTask.reduce((sum, u) => sum + u.minutesUnassigned, 0);

  return {
    weekStart: todayStr,
    items,
    unassignedMinutes,
    unassignedByTask,
  };
}

// ---------------------------------------------------------------------------
// "Tengo X minutos" (section 6) — extends the existing recommendation with
// a concrete micro-step instead of just a task name.
// ---------------------------------------------------------------------------

export const QUICK_MINUTE_OPTIONS = [5, 10, 15, 30, 60] as const;

export function buildMicroStep(
  task: PlannableTask,
  availableMinutes: number,
  now: Date,
  method: SessionMethod = "questions"
): string {
  const dueSoon = task.dueAt ? Math.ceil((new Date(task.dueAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const dueSuffix = dueSoon === 0 ? " (vence hoy)" : dueSoon === 1 ? " (vence mañana)" : "";
  const topic = task.title;

  if (availableMinutes <= 5) {
    return `En 5 minutos: repasa mentalmente los puntos clave de "${topic}"${dueSuffix} y anota una sola duda pendiente.`;
  }
  if (availableMinutes <= 10) {
    return `En 10 minutos: responde 3 preguntas de repaso sobre "${topic}"${dueSuffix}. Después identifica cuál necesitas repasar de nuevo.`;
  }
  if (availableMinutes <= 15) {
    return `En 15 minutos: repasa un resumen breve de "${topic}"${dueSuffix} y escribe 2 ejemplos con tus propias palabras.`;
  }
  if (availableMinutes <= 30) {
    const verb = method === "exercises" ? "practica ejercicios" : method === "steps" ? "avanza paso a paso" : "repasa";
    return `En 30 minutos: ${verb} sobre "${topic}"${dueSuffix} y deja anotado hasta dónde llegaste.`;
  }
  if (task.estimatedMinutes && task.estimatedMinutes <= availableMinutes) {
    return `En ${availableMinutes} minutos: alcanza a completar "${topic}"${dueSuffix} — te toma ~${task.estimatedMinutes} min en total.`;
  }
  return `En ${availableMinutes} minutos: dedica este bloque a "${topic}"${dueSuffix}. Define un objetivo concreto para el final del bloque y anota tu avance.`;
}

/**
 * Rule-based (no AI, no cost) extraction for the StudyFlow Inbox. Students
 * without an AI provider configured — or on a plan that doesn't include AI
 * extraction — still get real due-date, subject and grade-weight detection
 * from common Spanish phrasing, not just "first sentence as title".
 *
 * This is deliberately not a replacement for the AI path's understanding of
 * arbitrary phrasing — it's a solid floor so StudyFlow is genuinely useful
 * for students who can't or don't want to pay for an AI API key.
 */

export interface RuleBasedExtractionInput {
  subjects: { id: string; name: string }[];
  now?: Date;
}

export interface RuleBasedExtractionResult {
  title: string;
  description: string;
  dueAt: string | null;
  subjectId: string | null;
  subjectGuess: string | null;
  gradeWeight: number | null;
  estimatedMinutes: number | null;
  confidence: number;
}

// Already accent-stripped — compared against `lower`, which is too.
const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const LEAD_IN_PHRASES = [
  /^el\s+(profesor|profe|profesora|docente)\s+(dijo|dice|pidió|pide|indicó|indica)\s+que\s+/i,
  /^la\s+(profesora|profe|docente)\s+(dijo|dice|pidió|pide|indicó|indica)\s+que\s+/i,
  /^nos\s+(dijeron|dijo|pidieron|pidió)\s+que\s+/i,
  /^(hay que|tenemos que|debemos|necesito|necesitamos)\s+/i,
];

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function atMidnight(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 0, 0);
  return copy;
}

function nextWeekday(now: Date, targetDay: number): Date {
  const result = new Date(now);
  const currentDay = result.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7; // "el miércoles" always means the upcoming one, not today
  result.setDate(result.getDate() + diff);
  return atMidnight(result);
}

function detectDueDate(text: string, now: Date): Date | null {
  const lower = stripAccents(text.toLowerCase());

  // `lower` already had accents stripped, so "mañana" reads as "manana" here.
  if (/\bhoy\b/.test(lower)) return atMidnight(now);
  if (/\bpasado\s+manana\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return atMidnight(d);
  }
  if (/\bmanana\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return atMidnight(d);
  }

  const inDaysMatch = lower.match(/\ben\s+(\d+)\s+dias?\b/);
  if (inDaysMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + Number(inDaysMatch[1]));
    return atMidnight(d);
  }

  const inWeeksMatch = lower.match(/\ben\s+(\d+)\s+semanas?\b/);
  if (inWeeksMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + Number(inWeeksMatch[1]) * 7);
    return atMidnight(d);
  }

  for (const [weekday, dayIndex] of Object.entries(WEEKDAY_INDEX)) {
    if (new RegExp(`\\b${weekday}\\b`).test(lower)) {
      return nextWeekday(now, dayIndex);
    }
  }

  // DD/MM or DD-MM, optionally with a 4-digit year
  const explicitDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    let year = explicitDate[3] ? Number(explicitDate[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const candidate = new Date(year, month, day, 23, 59, 0, 0);
    if (!explicitDate[3] && candidate.getTime() < now.getTime()) candidate.setFullYear(year + 1);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }

  return null;
}

function detectGradeWeight(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 0 && value <= 100 ? value : null;
}

/** Exported so callers (e.g. the AI extraction path, which knows subject
 * names but not StudyFlow subject ids) can resolve a `subjectId` from the
 * raw text the same way the rule-based path does. */
export function matchSubjectInText(
  text: string,
  subjects: { id: string; name: string }[]
): { id: string; name: string } | null {
  const lower = stripAccents(text.toLowerCase());
  for (const subject of subjects) {
    const subjectLower = stripAccents(subject.name.toLowerCase());
    if (subjectLower.length >= 3 && lower.includes(subjectLower)) return subject;
  }
  return null;
}

function buildTitle(text: string): string {
  let cleaned = text.trim();
  for (const pattern of LEAD_IN_PHRASES) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.trim();
  const firstSentence = cleaned.split(/[.\n]/)[0]?.trim() ?? cleaned;
  const withCapital = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
  return withCapital.length > 120 ? `${withCapital.slice(0, 117)}...` : withCapital || "Nueva tarea";
}

export function extractTaskFromText(
  text: string,
  { subjects, now = new Date() }: RuleBasedExtractionInput
): RuleBasedExtractionResult {
  const dueDate = detectDueDate(text, now);
  const gradeWeight = detectGradeWeight(text);
  const subject = matchSubjectInText(text, subjects);

  let confidence = 0.35;
  if (dueDate) confidence += 0.2;
  if (gradeWeight !== null) confidence += 0.1;
  if (subject) confidence += 0.15;

  return {
    title: buildTitle(text),
    description: text,
    dueAt: dueDate ? dueDate.toISOString() : null,
    subjectId: subject?.id ?? null,
    subjectGuess: subject?.name ?? null,
    gradeWeight,
    estimatedMinutes: null,
    confidence: Math.min(confidence, 0.75),
  };
}

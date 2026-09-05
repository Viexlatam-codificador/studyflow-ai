"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { TaskWithSubject } from "@/lib/data/tasks";
import { rescheduleTask, updateCalendarTheme } from "@/lib/actions/calendar";
import { THEME_PRESETS, resolveThemeBackground, type CalendarTheme } from "@/lib/calendar-themes";
import { formatMonthYear } from "@/lib/format-date";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthGrid(monthDate: Date): Date[] {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function InteractiveCalendar({
  tasks,
  initialTheme,
}: {
  tasks: TaskWithSubject[];
  initialTheme: CalendarTheme;
}) {
  const router = useRouter();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [localTasks, setLocalTasks] = useState(tasks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [theme, setTheme] = useState<CalendarTheme>(initialTheme);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState(theme.imageUrl ?? "");
  const [isPending, startTransition] = useTransition();

  const grid = useMemo(() => getMonthGrid(monthDate), [monthDate]);
  const today = dateKey(new Date());

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithSubject[]>();
    for (const task of localTasks) {
      if (!task.dueAt) continue;
      const key = dateKey(new Date(task.dueAt));
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [localTasks]);

  const { background, mode } = resolveThemeBackground(theme);
  const textTone = mode === "dark" ? "text-foreground" : "text-white";

  function handleDrop(targetKey: string) {
    if (!draggedId) return;
    const taskId = draggedId;
    setDraggedId(null);
    setDragOverKey(null);

    setLocalTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.dueAt) return t;
        const previous = new Date(t.dueAt);
        const [y, m, d] = targetKey.split("-").map(Number);
        const next = new Date(y, m - 1, d, previous.getHours(), previous.getMinutes());
        return { ...t, dueAt: next.toISOString() };
      })
    );

    startTransition(async () => {
      await rescheduleTask(taskId, targetKey);
      router.refresh();
    });
  }

  function saveTheme(next: CalendarTheme) {
    setTheme(next);
    startTransition(async () => {
      await updateCalendarTheme(next);
    });
  }

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border p-4 shadow-lg transition-all duration-500 sm:p-6"
      style={{ background }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition hover:scale-105 active:scale-95 ${textTone} bg-white/15 backdrop-blur`}
          >
            ‹
          </button>
          <h2 className={`min-w-[160px] text-center text-lg font-semibold capitalize ${textTone}`}>
            {formatMonthYear(monthDate)}
          </h2>
          <button
            onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition hover:scale-105 active:scale-95 ${textTone} bg-white/15 backdrop-blur`}
          >
            ›
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowThemePicker((v) => !v)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition hover:scale-105 active:scale-95 ${textTone} bg-white/15 backdrop-blur`}
          >
            🎨 Personalizar
          </button>

          <AnimatePresence>
            {showThemePicker && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  Elige tu estilo
                </p>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => saveTheme({ preset: preset.id })}
                      className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-lg transition hover:scale-105 ${
                        theme.preset === preset.id && !theme.imageUrl ? "ring-2 ring-brand-violet" : ""
                      }`}
                      style={{ background: preset.background }}
                      title={preset.label}
                    >
                      <span>{preset.emoji}</span>
                    </button>
                  ))}
                </div>
                <p className="mb-1 text-xs font-medium text-foreground/60">O pega una imagen tuya (URL)</p>
                <div className="flex gap-1">
                  <input
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => customImageUrl && saveTheme({ preset: theme.preset, imageUrl: customImageUrl })}
                    className="shrink-0 rounded-lg bg-brand-violet px-2 py-1 text-xs font-medium text-white"
                  >
                    Usar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className={`px-1 pb-1 text-center text-xs font-semibold ${textTone} opacity-80`}>
            {label}
          </div>
        ))}

        {grid.map((day) => {
          const key = dateKey(day);
          const dayTasks = tasksByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const isToday = key === today;
          const isDragOver = dragOverKey === key;

          return (
            <div
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(key);
              }}
              className={`flex min-h-[84px] flex-col gap-1 rounded-xl p-1.5 transition-all duration-200 sm:min-h-[104px] ${
                isCurrentMonth ? "bg-white/90" : "bg-white/40"
              } ${isToday ? "ring-2 ring-brand-violet" : ""} ${isDragOver ? "scale-105 bg-white ring-2 ring-brand-success" : ""}`}
            >
              <span className={`text-xs font-medium ${isCurrentMonth ? "text-foreground/70" : "text-foreground/30"}`}>
                {day.getDate()}
              </span>

              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                <AnimatePresence initial={false}>
                  {dayTasks.slice(0, 3).map((task) => (
                    <motion.div
                      key={task.id}
                      layoutId={task.id}
                      layout
                      draggable
                      onDragStart={() => setDraggedId(task.id)}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverKey(null);
                      }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ scale: 1.04 }}
                      whileDrag={{ scale: 1.1, boxShadow: "0 8px 20px rgba(0,0,0,0.25)" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="cursor-grab truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm active:cursor-grabbing"
                      style={{ backgroundColor: task.subjectColor ?? "#7C3AED" }}
                      title={task.title}
                    >
                      {task.title}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {dayTasks.length > 3 && (
                  <span className="text-[10px] font-medium text-foreground/50">+{dayTasks.length - 3} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className={`mt-3 text-center text-xs ${textTone} opacity-70`}>
        Arrastra una tarea a otro día para cambiar su fecha {isPending && "· guardando…"}
      </p>
    </div>
  );
}

import type { TaskWithSubject } from "@/lib/data/tasks";

/** Pure sorting helpers with no server-only dependencies, so client
 * components (e.g. the drag-to-reorder task list) can import them directly
 * without pulling in `lib/supabase/server.ts` (which uses next/headers and
 * cannot be bundled for the client). */

export function rankByPriority(tasks: TaskWithSubject[]): TaskWithSubject[] {
  return [...tasks].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
}

/** Manual order first (nulls last), so a partially-ordered list still makes
 * sense — un-placed tasks fall back to priority order among themselves. */
export function rankByManualOrder(tasks: TaskWithSubject[]): TaskWithSubject[] {
  const placed = tasks.filter((t) => t.sortOrder !== null).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const unplaced = rankByPriority(tasks.filter((t) => t.sortOrder === null));
  return [...placed, ...unplaced];
}

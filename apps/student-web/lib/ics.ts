import "server-only";

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string | null;
  dueAt: string; // ISO datetime
}

function toIcsDate(iso: string): string {
  // RFC 5545 UTC form: 20260902T235900Z
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Builds a minimal, valid RFC 5545 calendar feed — one VEVENT per task
 * with a due date. Deliberately simple (no reminders/alarms yet) so any
 * calendar app (Google/Apple/Outlook) can subscribe to it reliably. */
export function buildIcsFeed(events: IcsEvent[]): string {
  const now = toIcsDate(new Date().toISOString());

  const veventBlocks = events.map((event) => {
    const dueDate = toIcsDate(event.dueAt);
    return [
      "BEGIN:VEVENT",
      `UID:${event.uid}@studyflow.ai`,
      `DTSTAMP:${now}`,
      `DTSTART:${dueDate}`,
      `DTEND:${dueDate}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : null,
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyFlow AI//Calendar Feed//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:StudyFlow AI",
    ...veventBlocks,
    "END:VCALENDAR",
  ].join("\r\n");
}

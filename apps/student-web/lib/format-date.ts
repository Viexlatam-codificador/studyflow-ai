/**
 * Deterministic Spanish date formatting for client components.
 *
 * `toLocaleDateString("es-CL", …)` renders slightly different strings on
 * Node's ICU data (SSR) vs. the browser's (hydration) — e.g. "2 sep." vs
 * "2 sept" — which React treats as a hydration mismatch. These hand-rolled
 * formatters produce the exact same string everywhere, every time.
 */

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** e.g. "2 sep, 14:03" */
export function formatShortDate(date: Date): string {
  const day = date.getDate();
  const month = MONTHS_SHORT[date.getMonth()];
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${day} ${month}, ${hours}:${minutes}`;
}

/** e.g. "septiembre 2026" */
export function formatMonthYear(date: Date): string {
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

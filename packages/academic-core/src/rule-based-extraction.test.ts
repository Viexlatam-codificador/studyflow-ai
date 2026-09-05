import { describe, expect, it } from "vitest";
import { extractTaskFromText } from "./rule-based-extraction";

// Wednesday, 2026-09-02
const NOW = new Date("2026-09-02T10:00:00");

const SUBJECTS = [
  { id: "s1", name: "Analítica Digital" },
  { id: "s2", name: "Marketing Estratégico" },
];

describe("extractTaskFromText", () => {
  it("detects 'mañana' as tomorrow", () => {
    const result = extractTaskFromText("Hay que entregar el informe mañana", { subjects: [], now: NOW });
    expect(result.dueAt).toBe(new Date("2026-09-03T23:59:00").toISOString());
  });

  it("detects a weekday name as the next occurrence of that day", () => {
    // NOW is a Wednesday — "el viernes" should be 2 days later
    const result = extractTaskFromText("Prueba el viernes", { subjects: [], now: NOW });
    expect(result.dueAt).toBe(new Date("2026-09-04T23:59:00").toISOString());
  });

  it("rolls a same-named weekday to the following week, not today", () => {
    // NOW is itself a Wednesday — "el miércoles" should mean next Wednesday
    const result = extractTaskFromText("Entrega el miércoles", { subjects: [], now: NOW });
    expect(result.dueAt).toBe(new Date("2026-09-09T23:59:00").toISOString());
  });

  it("extracts grade weight from a percentage", () => {
    const result = extractTaskFromText("El trabajo vale 30% de la nota", { subjects: [], now: NOW });
    expect(result.gradeWeight).toBe(30);
  });

  it("matches a known subject by name", () => {
    const result = extractTaskFromText("En Analítica Digital hay que hacer un benchmark", {
      subjects: SUBJECTS,
      now: NOW,
    });
    expect(result.subjectId).toBe("s1");
    expect(result.subjectGuess).toBe("Analítica Digital");
  });

  it("strips common lead-in phrases from the title, chaining multiple if present", () => {
    const result = extractTaskFromText("El profe dijo que hay que leer el capítulo 4", {
      subjects: [],
      now: NOW,
    });
    expect(result.title.toLowerCase()).not.toContain("el profe dijo que");
    expect(result.title.toLowerCase()).not.toContain("hay que");
    expect(result.title).toBe("Leer el capítulo 4");
  });

  it("gives higher confidence when more fields are detected", () => {
    const rich = extractTaskFromText("En Analítica Digital, la prueba es el viernes y vale 20%", {
      subjects: SUBJECTS,
      now: NOW,
    });
    const bare = extractTaskFromText("hay que estudiar algo", { subjects: SUBJECTS, now: NOW });
    expect(rich.confidence).toBeGreaterThan(bare.confidence);
  });

  it("falls back to a truncated first sentence when nothing else matches", () => {
    const result = extractTaskFromText("algo sin fecha ni asignatura ni porcentaje.", { subjects: [], now: NOW });
    expect(result.dueAt).toBeNull();
    expect(result.gradeWeight).toBeNull();
    expect(result.subjectId).toBeNull();
    expect(result.title.length).toBeGreaterThan(0);
  });
});

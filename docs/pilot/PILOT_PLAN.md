# Plan piloto — StudyFlow AI

## Objetivo

Validar con un grupo real de estudiantes (inicialmente de Duoc UC, sin que
el producto dependa de esa institución) si StudyFlow ayuda a organizar
tareas y sesiones de estudio de forma medible.

## Alcance del piloto

- Cohorte: 20-50 estudiantes voluntarios de una o dos carreras.
- Duración sugerida: 4-6 semanas (un mes académico completo).
- Funcionalidad disponible: todo lo de Fase 1 (auth, onboarding, tareas,
  StudyFlow Inbox por texto, calendario, sesiones de estudio) + lo que esté
  estable de Fase 2 al momento de lanzar.
- Sin integración Blackboard real (ver `docs/duoc-integration/`) — entrada
  manual y captura por Inbox.

## Mecánica

1. Onboarding guiado (< 3 minutos, sección 30 del spec de producto).
2. Uso libre durante el período del piloto.
3. Encuesta corta de salida (percepción de utilidad, facilidad de uso,
   probabilidad de seguir usándolo).
4. Founder Admin (`apps/admin-web/analytics`) para monitorear KPIs en vivo.

## Salida del piloto

Un reporte con los KPIs de `KPIS.md`, feedback cualitativo, y una decisión
go/no-go para pasar a licenciamiento institucional formal
(`docs/pilot/DUOC_PITCH.md`).

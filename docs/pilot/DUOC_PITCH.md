# Propuesta para Duoc UC (borrador)

> Borrador de pitch — completar con datos reales del piloto antes de enviar.

## Qué es StudyFlow AI

Un sistema operativo académico que ayuda a cada estudiante a organizar
clases, tareas, evaluaciones y sesiones de estudio en un solo lugar, con
asistencia de IA opcional para extraer tareas desde texto/fotos/audio y
planificar el tiempo de estudio disponible.

## Por qué un piloto sin integración de sistemas

StudyFlow funciona completo sin ninguna integración con Blackboard u otros
sistemas de Duoc — el estudiante ingresa su información manualmente o vía
StudyFlow Inbox. Esto permite validar el valor del producto **antes** de
pedir cualquier acceso técnico institucional (ver
`docs/duoc-integration/INTEGRATION_REQUEST.md` para lo que se necesitaría
en una fase posterior, opcional).

## Qué pedimos para el piloto

- Difusión del piloto a un grupo de estudiantes voluntarios (ver
  `PILOT_PLAN.md`).
- Nada de acceso a sistemas, credenciales ni datos institucionales en esta
  etapa.

## Qué entregamos al final

Un reporte de KPIs de uso (`KPIS.md`) y feedback cualitativo, sin
afirmaciones de impacto académico no verificadas.

## Siguiente paso (si el piloto es exitoso)

Conversación sobre `StudyFlow Campus` — licenciamiento institucional
(`supabase/migrations/0010_billing.sql`: `institution_contracts`,
`licenses`) y, opcionalmente, integración oficial vía OAuth con
Blackboard (`docs/duoc-integration/INTEGRATION_REQUEST.md`).

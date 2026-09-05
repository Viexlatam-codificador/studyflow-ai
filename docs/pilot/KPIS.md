# KPIs del piloto

Todos estos ya son consultables hoy desde `apps/admin-web/analytics` y
`apps/admin-web/dashboard` (queries reales sobre Supabase, no mock data).

| KPI | Cómo se mide | Dónde |
|---|---|---|
| Usuarios activos (DAU/WAU/MAU) | usuarios distintos con al menos un `usage_event` en 1/7/30 días | `admin-web/dashboard` |
| Tareas creadas | `count(tasks)` | `admin-web/dashboard`, `admin-web/analytics` |
| Tareas completadas | `count(tasks where status in (COMPLETED, SUBMITTED))` | `admin-web/analytics` |
| % completadas a tiempo | completadas con `updated_at <= due_at` sobre el total completado | `admin-web/analytics` |
| Sesiones de estudio | `count(study_sessions)` | `admin-web/dashboard`, `admin-web/analytics` |
| Uso de IA (StudyFlow Inbox) | % de `inbox_items` confirmados vs. descartados | `admin-web/analytics` |
| Retención | usuarios con actividad en semana N vs. semana 1 (pendiente: vista dedicada; hoy se calcula desde `usage_events` manualmente) | — |

## Advertencia de honestidad de datos

**No se afirma mejora académica causal** (notas, aprobación de ramos) sin
evidencia — StudyFlow mide *uso y organización*, no *resultados
académicos*, salvo que un estudio controlado lo respalde explícitamente.
Esto aplica a cualquier material de pitch o marketing derivado del piloto.

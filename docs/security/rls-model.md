# Modelo de RLS — StudyFlow AI

Fuente de verdad: `supabase/migrations/0002_identity_and_roles.sql` a
`0011_platform_admin.sql`. Este documento resume la matriz de acceso.

| Tabla | Lectura | Escritura |
|---|---|---|
| `profiles` | dueño o staff | dueño o staff (owner_locked protegido por trigger, no removible salvo `service_role`) |
| `user_roles` | dueño o staff | solo OWNER/SUPER_ADMIN; fila `OWNER` inmutable (trigger `protect_owner_role`) |
| `institutions`/`campuses`/`careers`/`academic_periods` | cualquier autenticado | admin de esa institución |
| `student_enrollments` | dueño, admin de la institución, o staff | dueño |
| `subjects`/`classes`/`class_sessions` | miembro de la asignatura o staff | admin de la institución / staff |
| `course_materials` | dueño; o miembros de la asignatura si `visibility = SUBJECT` | dueño |
| `tasks`, `task_subtasks`, `task_attachments`, `inbox_items`, `assignments`, `evaluations`, `grades`, `calendar_events`, `study_sessions`, `study_plans`, `ai_conversations` | **solo el dueño** (o staff) | **solo el dueño** (o staff) |
| `subscriptions`, `entitlements`, `payments` | dueño o staff | solo `service_role` o OWNER (nunca el usuario directamente) |
| `licenses`, `institution_contracts` | admin de esa institución o staff | solo OWNER/SUPER_ADMIN |
| `feature_flags`, `feature_flag_assignments` | cualquier autenticado (lectura) | solo OWNER/SUPER_ADMIN |
| `audit_logs`, `admin_actions` | solo staff | inserción por autenticado o `service_role` (append-only, sin update/delete expuesto) |
| `consent_records` | dueño o staff | dueño |
| `usage_events` | solo staff (lectura) | dueño o `service_role` |

## Invariantes verificadas por diseño (pendientes de test automatizado)

1. Usuario A nunca puede leer `tasks`/`study_sessions`/`inbox_items` de
   usuario B — `user_id = auth.uid()` en cada política, sin excepción para
   roles no-staff.
2. Un `STUDENT_FREE`/`STUDENT_PRO` no tiene ninguna policy de escritura en
   `user_roles`, `subscriptions`, `entitlements`, `licenses` — esas tablas
   solo aceptan escritura de OWNER/SUPER_ADMIN/`service_role`.
3. Ni siquiera un `SUPER_ADMIN` puede borrar o degradar la fila `OWNER` en
   `user_roles` — el trigger `protect_owner_role` bloquea la operación
   independientemente de la policy RLS que la permitiría.
4. `entitlements.plan_key` para un usuario `COMPLIMENTARY`/`PILOT` resuelve
   a `CAMPUS`/`PRO` vía `recompute_entitlement`, no por edición manual del
   campo.

Ver `supabase/tests/` para las pruebas pgTAP que verifican estos puntos —
no se pudieron ejecutar en este entorno de desarrollo (sin Postgres/Docker
disponibles); correr `supabase test db` contra un proyecto local antes de
confiar en ellas para producción.

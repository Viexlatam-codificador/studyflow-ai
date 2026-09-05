# Arquitectura — StudyFlow AI

## Vista general

```
Usuario (web / mobile)
   │
   ▼
apps/student-web  ──┐
apps/admin-web    ──┤──►  Supabase (Postgres + Auth + Storage + RLS)
apps/mobile       ──┘             │
                                   ▼
                          AIProvider (packages/ai-core)
                          → OpenAI / Anthropic / Google Gemini
```

- **student-web** y **admin-web** son dos apps Next.js independientes,
  desplegadas por separado en Vercel. No comparten sesión de auth (cada
  una gestiona su propio login contra el mismo proyecto Supabase).
- Toda lógica de negocio compartida vive en `packages/`, nunca duplicada
  entre apps.
- La base de datos es la fuente de verdad para permisos: RLS + triggers,
  no solo checks en el frontend.

## Multiinstitución

`Institution → Campus → Career → AcademicPeriod → Subject → ClassSession`.
Nada en el código depende de una institución específica — la instancia
"Duoc UC" es solo una fila en `institutions`, creada vía seed/admin, igual
que cualquier otra universidad futura.

## RBAC

Roles (`app_role` enum en Postgres): `OWNER`, `SUPER_ADMIN`,
`INSTITUTION_ADMIN`, `PROFESSOR`, `SUPPORT`, `STUDENT_PRO`, `STUDENT_FREE`.

El rol `OWNER` se auto-otorga en la base de datos cuando el email
configurado en `platform_config.owner_bootstrap_email` verifica su correo
(trigger `bootstrap_owner_on_verified_email`), y queda protegido contra
degradación/eliminación por otro trigger (`protect_owner_role`) — ver
`supabase/migrations/0002_identity_and_roles.sql`.

## Entitlements

Nunca `premium = true`. `entitlements` es una tabla derivada, recalculada
por trigger cada vez que cambian `subscriptions`, `license_grants` o
`user_roles` (función `recompute_entitlement`). Un OWNER siempre resuelve a
`CAMPUS` / `LIFETIME` sin pasar por suscripción.

## AIProvider

`packages/ai-core` define una interfaz (`complete`, `extractStructured`,
`embed`) implementada por tres adaptadores (OpenAI, Anthropic, Google
Gemini) que llaman directamente a las REST API de cada proveedor (sin SDKs
externos, para no atar el monorepo a dependencias que no se puedan
instalar sin red). `AI_PROVIDER` en `.env` decide cuál se usa — cambiar de
proveedor no toca código de producto.

## StudyFlow Inbox

Todo lo que entra por el Inbox (texto en Fase 1; foto/audio/documento en
Fase 2) pasa por `inbox_items` con estado `PENDING_REVIEW` y **nunca** crea
una fila en `tasks` sin que el usuario confirme explícitamente el borrador
— ver `apps/student-web/lib/actions/inbox.ts` y
`packages/shared/src/tasks.ts` (`INBOX_REQUIRES_CONFIRMATION`).

## Motor de prioridad

`packages/academic-core/src/priority-engine.ts` calcula un score 0-100 a
partir de pesos documentados (urgencia, peso de nota, dificultad, avance,
carga de trabajo) — no hay números mágicos sueltos en el código de UI.

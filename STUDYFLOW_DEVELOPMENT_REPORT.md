# STUDYFLOW AI — DEVELOPMENT REPORT

Sesión: construcción autónoma de Fase 1 (MVP) del monorepo `studyflow-ai/`
en `~/Desktop/Trabajos/studyflow-ai`, nuevo repo git local (no había uno
previo en `~/Desktop/Trabajos`, que es una carpeta compartida con otros
proyectos del usuario — por eso se creó `studyflow-ai/` como proyecto
propio en vez de usar el directorio raíz).

## 1. Qué construí

**Monorepo** (`apps/`, `packages/`, `supabase/`, `docs/`, `.github/`) con
npm workspaces (no había pnpm/Flutter/Supabase CLI instalados; se usó
npm workspaces y migraciones SQL escritas a mano).

**Supabase** (`supabase/migrations/0001`–`0011`):
- Esquema completo: identidad/RBAC, instituciones multinivel, estructura
  académica, tareas + StudyFlow Inbox, calendario/sesiones de estudio,
  notificaciones, IA, integraciones, billing/entitlements, feature flags/
  auditoría/consentimiento.
- RLS en **todas** las tablas. Aislamiento estricto por `user_id` en datos
  personales (tareas, sesiones, inbox, materiales privados).
- OWNER bootstrap automático por email verificado
  (`viexlatam@gmail.com`, configurable en `platform_config`) + protegido
  contra degradación/eliminación por triggers, no solo por RLS.
- `entitlements` derivado por trigger desde `subscriptions`/`license_grants`
  /`user_roles` — nunca un campo `premium=true`.
- Seed de datos demo ficticios (institución, carrera, semestre, 4 asignaturas).

**`apps/student-web`** (Next.js 16 + TypeScript + Tailwind v4):
landing, auth (signup/login/logout), onboarding, dashboard ("¿qué debo
hacer hoy?"), tareas (crear/completar/eliminar + prioridad calculada),
StudyFlow Inbox por texto (con paso de confirmación obligatorio, nunca
autoguardado, y gateado por plan Free/Pro), calendario de 14 días, sesión
de estudio + "Tengo X minutos", PWA manifest.

**`apps/admin-web`** (Founder panel): dashboard de métricas reales
(usuarios, DAU/WAU/MAU, planes, MRR estimado, costo IA, tareas, sesiones),
usuarios (otorgar/revocar acceso gratuito con auditoría), instituciones
(crear + gestionar carreras/semestres/asignaturas), suscripciones,
licencias, uso de IA, analíticas, feature flags (toggle real), auditoría,
configuración. Todo gateado por rol staff vía `proxy.ts` + RLS.

**`packages/`**: `shared` (tipos), `academic-core` (motor de prioridad
documentado + "Tengo X minutos", con 8 tests unitarios pasando),
`ai-core` (abstracción `AIProvider` con adaptadores reales OpenAI/
Anthropic/Google Gemini vía REST, sin SDKs externos), `integrations`
(`IntegrationProvider` para Blackboard — deshabilitado hasta autorización
real; `BillingProvider` mock hasta tener Stripe), `ui` (tokens de marca).

**Docs**: README, CONTRIBUTING, arquitectura, notas de Next.js 16
(Middleware→Proxy), modelo de RLS, integración Duoc/Blackboard, plan de
piloto + KPIs + pitch, roadmap, pricing.

**CI**: `.github/workflows/ci.yml` (lint, typecheck, test, build).

7 commits, historial limpio, sin secretos en git (verificado).

## 2. Qué funciona (verificado en este entorno)

- `npm install` en la raíz — instala y enlaza los 7 workspaces.
- `npm run build/lint/typecheck` — **verde en ambas apps y los 5 packages**.
- `packages/academic-core` — 8/8 tests unitarios pasando (Vitest).
- Next.js 16 detectó y compiló correctamente `proxy.ts` (el archivo que
  reemplaza a `middleware.ts` desde la v16 — ver
  `docs/architecture/next16-notes.md`).

## 3. Qué falta (honesto, no maquillado)

- **No se pudo probar en runtime real** — no hay proyecto Supabase
  conectado en este entorno, así que auth/RLS/onboarding/dashboard nunca
  se ejecutaron contra una base de datos viva. El código está completo y
  tipado, pero "compila" ≠ "funciona en producción".
- **`supabase/tests/rls_test.sql`** (pgTAP) está escrito pero **sin
  ejecutar** — no había Postgres/Docker disponibles en este entorno.
  Correr `supabase test db` antes de confiar en él.
- **Fase 2 no implementada**: subida de documentos + RAG real, fotos de
  pizarra, audio del profesor, planificador semanal automático,
  notificaciones (cron), tutor con chat real conectado.
- **`apps/mobile` (Flutter)**: solo documentado, no generado — no había
  Flutter CLI en este entorno y escribir `.dart` sin poder compilarlo
  parecía peor que dejarlo bien planeado (`apps/mobile/README.md`).
- **Feature flags**: la función SQL `is_feature_enabled()` existe pero
  ningún código de producto la consume todavía — hoy solo gatea el toggle
  global desde el admin.
- **Landing/assets de marca**: no hay logo real ni iconos PWA
  (`public/manifest.webmanifest` referencia `/icons/icon-192.png` que no
  existe) — falta la pieza de diseño de marca.
- **Stripe / pagos reales**: no conectado (`BILLING_PROVIDER=mock`
  lanza error explícito en vez de fingir un pago exitoso).

## 4. Credenciales que se necesitan para avanzar

- Proyecto Supabase real (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Al menos una API key de IA (`OPENAI_API_KEY` o `ANTHROPIC_API_KEY` o
  `GOOGLE_GENERATIVE_AI_API_KEY`) para que StudyFlow Inbox use IA real en
  vez del fallback naive (que sigue funcionando sin IA, solo con menos
  autocompletado).
- Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) para cobros reales.
- Autorización institucional de Blackboard (ver
  `docs/duoc-integration/INTEGRATION_REQUEST.md`) — opcional, el producto
  funciona completo sin esto.

## 5. Errores conocidos que quedan

Ninguno bloqueante en lo implementado (build/lint/typecheck limpios). Los
gaps de la sección 3 son alcance no cubierto, no bugs.

## 6. Commits

```
163e45a feat: gate StudyFlow Inbox AI extraction behind Pro entitlement
78ca9ce feat: admin can create careers, academic periods and subjects per institution
57b84f3 docs: add README, CONTRIBUTING, architecture/security/product/pilot/business docs, CI, RLS tests, mobile plan
b5eed43 fix: correct priority-engine test expectations and ai-core fetch response typing
dce3c32 feat: implement admin-web — founder dashboard, users, institutions, feature flags, audit
b8ab276 feat: implement student-web — auth, onboarding, dashboard, tasks, inbox, calendar, study sessions
514abcc feat: add shared packages — types, priority engine, AIProvider abstraction, integrations
1c3dcd4 feat: add Supabase academic schema, RBAC, entitlements and RLS
```

## 7. Pull Requests

Ninguno — no hay remoto configurado (repo local nuevo). Correr
`git remote add origin <url>` y `git push -u origin main` cuando exista un
repositorio en GitHub, o pedir que lo cree.

## 8. URLs disponibles

Ninguna desplegada todavía. `apps/student-web` y `apps/admin-web` están
listas para `vercel --cwd apps/student-web` / `apps/admin-web` una vez
que existan las variables de entorno de Supabase.

## 9. Próximo paso recomendado

1. Crear el proyecto Supabase real, aplicar las migraciones en orden, y
   correr el flujo completo (signup → verificar email → onboarding →
   crear tarea) para encontrar los bugs de integración que un build en
   seco no puede detectar.
2. Correr `supabase test db` con el pgTAP de `supabase/tests/` y arreglar
   lo que falle.
3. Conseguir una API key de IA y probar StudyFlow Inbox con extracción
   real (hoy el fallback naive funciona pero es deliberadamente básico).
4. Recién entonces, avanzar a Fase 2 (documentos/RAG, fotos, audio).

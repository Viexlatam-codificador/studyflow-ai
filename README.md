# StudyFlow AI

**Tu estudio, organizado por IA.**

StudyFlow AI es un sistema operativo académico: reúne clases, tareas,
documentos y evaluaciones en un solo lugar, y responde una pregunta —
*¿qué debo hacer ahora para avanzar en mis estudios?*

Founder & Creator: **Nicolás Leiva**

## Estado actual (Fase 1 — MVP)

Implementado y funcionando (build + typecheck + lint verdes):

- **Landing page** (`apps/student-web`) con propuesta de valor y planes.
- **Auth** con Supabase (signup/login/logout, verificación de email).
- **Onboarding**: institución → carrera → semestre → asignaturas.
- **Dashboard** ("¿Qué debo hacer hoy?"): urgente/hoy/mañana, recomendación IA.
- **Tareas**: CRUD manual + prioridad calculada (`packages/academic-core`).
- **StudyFlow Inbox (texto)**: extrae una tarea de un texto libre, siempre
  con confirmación manual antes de guardar — nunca automático.
- **Calendario**: vista de 14 días con tareas/evaluaciones.
- **Sesión de estudio** + modo "Tengo X minutos".
- **Founder Admin** (`apps/admin-web`): dashboard de métricas, usuarios y
  licencias gratuitas, instituciones, feature flags, auditoría.
- **Supabase**: esquema completo con RLS, RBAC, OWNER protegido en DB,
  entitlements derivados de suscripciones/licencias (nunca `premium=true`).
- **AIProvider**: abstracción con adaptadores OpenAI / Anthropic / Google
  Gemini — cambiar de proveedor es una variable de entorno, no código.

Pendiente (ver `STUDYFLOW_DEVELOPMENT_REPORT.md` para el detalle):
subida de documentos + RAG real, fotos de pizarra, audio del profesor,
Flutter mobile, notificaciones push, integración Blackboard real (requiere
autorización institucional), Stripe.

## Arquitectura

```
studyflow-ai/
  apps/
    student-web/     Next.js 16 (App Router) — la app del estudiante
    admin-web/        Next.js 16 (App Router) — panel Founder
    mobile/           Flutter — Fase 3, aún no implementado
  packages/
    shared/            Tipos y constantes compartidos
    academic-core/      Motor de prioridad, recomendaciones "Tengo X minutos"
    ai-core/            Abstracción AIProvider (OpenAI/Anthropic/Gemini)
    integrations/        IntegrationProvider (Blackboard/calendarios) + BillingProvider
    ui/                  Tokens de marca compartidos
  supabase/
    migrations/          Esquema completo + RLS (fuente de verdad)
    seed/                Datos demo ficticios
    policies/             Documentación del modelo RLS
    tests/                Pruebas pgTAP de seguridad/permisos
  docs/
    architecture/, security/, product/, duoc-integration/, pilot/, business/
```

Ver `docs/architecture/overview.md` para el detalle de decisiones.

## Stack

- **Web**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS).
- **IA**: abstracción propia sobre OpenAI / Anthropic / Google Gemini.
- **Mobile** (Fase 3): Flutter.
- **Deploy**: Vercel (student-web y admin-web se despliegan por separado).

> **Nota técnica**: este proyecto usa Next.js 16, que renombró
> "Middleware" a **"Proxy"** (`proxy.ts` en vez de `middleware.ts`, función
> `proxy()` en vez de `middleware()`). Ver `docs/architecture/next16-notes.md`.

## Instalación

Requisitos: Node.js ≥ 20, una cuenta de Supabase (proyecto gratuito sirve
para desarrollo).

```bash
npm install
cp .env.example apps/student-web/.env.local
cp .env.example apps/admin-web/.env.local
# Completa NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
# SUPABASE_SERVICE_ROLE_KEY en ambos .env.local con los datos de tu proyecto.
```

### Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Instala la CLI (`brew install supabase/tap/supabase` o ver su doc) y
   enlaza el proyecto, o aplica las migraciones manualmente desde el SQL
   Editor del dashboard, en orden: `supabase/migrations/0001_...sql` hasta
   `0011_...sql`. Para copiar/pegar en un solo paso, usa
   `supabase/combined_setup.sql` (migraciones + seed concatenados —
   regenerar con el bloque de comandos en la sección "Instalación" del
   chat de esta sesión si las migraciones cambian).
3. Aplica `supabase/seed/seed.sql` para datos demo (ya incluido si usaste
   `combined_setup.sql`).
4. En **Authentication → Settings**, activa confirmación de email.
5. La primera vez que `viexlatam@gmail.com` (o el valor que configures en
   `platform_config.owner_bootstrap_email`) verifique su correo, la
   base de datos le otorga el rol `OWNER` automáticamente (ver
   `supabase/migrations/0002_identity_and_roles.sql`).

### Desarrollo

```bash
npm run dev:student   # http://localhost:3000
npm run dev:admin     # http://localhost:3001 (usar `next dev -p 3001`)
```

### Calidad

```bash
npm run lint
npm run typecheck
npm run build
npm run test --workspace=packages/academic-core
```

## Testing

- `packages/academic-core`: pruebas unitarias del motor de prioridad
  (Vitest) — `npm run test --workspace=packages/academic-core`.
- `supabase/tests/`: pruebas pgTAP de RLS/permisos (aislamiento entre
  usuarios, protección del OWNER, gating FREE/PRO). Requieren
  `supabase test db` con un proyecto local — no se han podido ejecutar
  en este entorno por no contar con Postgres/Docker disponibles; revisar
  antes de confiar en ellas.

## Deployment

`apps/student-web` y `apps/admin-web` se despliegan como dos proyectos
Vercel independientes, apuntando cada uno a su carpeta dentro del monorepo
(Root Directory = `apps/student-web` / `apps/admin-web`).

## Roadmap

Ver `docs/product/roadmap.md` y las fases definidas en el spec original
(Fase 2: documentos/IA/planificador; Fase 3: Flutter + push + audio;
Fase 4: integraciones; Fase 5: StudyFlow Campus).

---

StudyFlow AI — Founder & Creator: **Nicolás Leiva**

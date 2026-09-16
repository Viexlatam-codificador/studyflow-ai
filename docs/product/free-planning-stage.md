# Etapa gratuita de planificación — entrega

Implementación del organizador académico gratuito descrito en el brief:
perfil de estudio, disponibilidad real, motor de plan semanal sin IA,
"Tengo X minutos" con micro-paso, flujo asistido "Personalizar con mi
Gemini", y observaciones de adaptación basadas en reglas.

**Nada de esto fue desplegado ni aplicado a una base de datos real.** Todo
queda en el working tree para revisión, tal como se pidió.

---

## 1. Cambios funcionales

### `packages/shared` (tipos, sin dependencias nuevas)
- `study-profile.ts` — `StudyProfile`, `SubjectConfidence`, métodos de
  explicación, preferencias de horario.
- `availability.ts` — `AvailabilityBlock`, `AvailabilityException`,
  `AvailabilitySettings`.
- `study-plan.ts` — `StudyPlan`, `StudyPlanItem`, resultado de sesión.
- `gemini-proposal.ts` — contrato versionado (`GEMINI_PROPOSAL_SCHEMA_VERSION
  = 1`) para la respuesta de Gemini y el contexto exportado.
- `study-observations.ts` — tipos para las observaciones de adaptación.

### `packages/academic-core` (motor puro, sin IA, sin Supabase)
- `zoned-time.ts` — conversión horario local ↔ UTC usando solo `Intl`
  nativo (sin librería de fechas nueva). Lee el tzdata real del runtime,
  así que refleja el horario de verano vigente para cualquier zona sin
  necesitar hardcodear reglas de Chile.
- `study-planner.ts` — `computeAvailableWindows` (convierte bloques +
  excepciones + tope diario en ventanas concretas) y `generateWeeklyPlan`
  (el motor principal: prioriza, reparte en sesiones, reserva descansos,
  reporta trabajo sin asignar). También `buildMicroStep` y
  `QUICK_MINUTE_OPTIONS` para "Tengo X minutos".
- `adaptation-engine.ts` — `computeObservations`, reglas transparentes con
  mínimo de evidencia documentado (`MIN_EVIDENCE_SESSIONS = 3`).
- Se extendió `index.ts` para exportar todo lo anterior.

### `apps/student-web`
- **Datos/acciones nuevas**: `lib/data/study-profile.ts`,
  `lib/actions/study-profile.ts`, `lib/data/availability.ts`,
  `lib/actions/availability.ts`, `lib/data/study-plan.ts`,
  `lib/actions/study-plan.ts`, `lib/gemini-context.ts`,
  `lib/gemini-proposal-validation.ts`, `lib/actions/gemini-proposal.ts`,
  `lib/data/observations.ts`, `lib/actions/observations.ts`.
- **Pantallas nuevas**: `/study/profile`, `/study/availability`,
  `/study/plan`, `/study/gemini` — todas enlazadas desde un nuevo panel de
  accesos en `/study`.
- **Dashboard**: se agregó "Próxima evaluación" y "Tiempo disponible hoy"
  (calculado con el mismo motor de disponibilidad), más accesos directos a
  "Tengo X minutos", "Capturar una tarea" y "Ver mi plan semanal".
- **"Tengo X minutos"**: ahora usa los accesos 5/10/15/30/60 exactos del
  brief, admite un valor personalizado, muestra un micro-paso concreto (no
  solo el nombre de la tarea), y ofrece un estado útil cuando no hay tareas
  (crear la primera, o elegir un tema de repaso entre las asignaturas del
  alumno).
- **Landing** (`app/page.tsx`): reescrita para prometer planes
  personalizados y organización en vez de una promesa genérica de "IA";
  explica qué pasa dentro de StudyFlow vs. qué hace el alumno en Gemini; se
  retiraron los planes Free/Pro/Campus y el "tutor con IA" (nunca
  implementados) y cualquier frase de resultado garantizado.

### Base de datos
Ver sección 2. Ninguna migración fue aplicada.

---

## 2. Migraciones y orden de aplicación

Todas viven en `supabase/migrations/` y ya están agregadas a
`supabase/combined_setup.sql` (instalación limpia). **Deben aplicarse en
este orden**, cada una depende de que la anterior ya exista:

1. `0018_study_profile.sql` — `study_profiles`, `study_subject_confidence`.
2. `0019_study_availability.sql` — `availability_blocks`,
   `availability_exceptions`, `availability_settings`.
3. `0020_study_plan_extensions.sql` — extiende `study_plans` y
   `study_plan_items` (ya existían desde `0006`, no se duplicaron).
4. `0021_study_session_results.sql` — extiende `study_sessions`.
5. `0022_gemini_proposals.sql` — tabla `gemini_proposals`.
6. `0023_study_observations.sql` — tabla `study_observations`.
7. `0024_regenerate_study_plan_function.sql` — función `regenerate_study_plan`
   (transaccional, `security invoker`, no otorga ningún privilegio nuevo).

**Cómo aplicarlas**: pegar cada archivo, en ese orden, en el SQL Editor del
proyecto de Supabase (mismo flujo manual usado en migraciones anteriores de
este proyecto), o usar `supabase db push` si el CLI queda enlazado al
proyecto.

**Supuesto verificado en el código, no en una base real**: `study_plans` y
`study_plan_items` no tenían ninguna fila en producción (el roadmap ya
documentaba que "hoy solo existe el motor de prioridad… falta el generador
de sesiones"), así que `0020` agrega columnas nuevas sin necesitar backfill.
Si esto resultara falso, la migración fallará de forma visible (columnas
`not null` sin default en filas existentes) — no falla en silencio.

**RLS**: todas las tablas nuevas quedan con `enable row level security` +
política `for all using (user_id = auth.uid() or is_staff())`, igual al
patrón usado en todo el resto del esquema. Las tablas extendidas
(`study_plans`, `study_plan_items`, `study_sessions`) ya tenían RLS desde
`0006`; agregar columnas no requiere nuevas políticas.

---

## 3. Pruebas y resultados reales

Todo lo que sigue **se ejecutó de verdad** en este entorno, hoy:

```
npm run test --workspace=packages/academic-core
```
```
 ✓ src/adaptation-engine.test.ts (10 tests)
 ✓ src/priority-engine.test.ts (8 tests)
 ✓ src/rule-based-extraction.test.ts (8 tests)
 ✓ src/zoned-time.test.ts (13 tests)
 ✓ src/study-planner.test.ts (19 tests)

 Test Files  5 passed (5)
      Tests  58 passed (58)
```

Casos cubiertos explícitamente (mapeados a la lista de la sección 12 del
brief):
- Alumno con solo 15 min/día → ninguna sesión excede 15 min; se reporta
  trabajo sin asignar.
- Alumno con trabajo y horario variable → el motor respeta bloques
  `WORK`/`CLASS` y solo agenda en `STUDY_WINDOW`.
- Evaluación cercana con carga imposible → se reporta `unassignedMinutes` en
  vez de sobre-comprometer o lanzar un error.
- Tareas sin fecha ni duración → reciben una sesión con estimación por
  defecto, marcada explícitamente como editable en el texto del objetivo.
- Bloques fijados y sesiones completadas → se excluyen del tiempo
  disponible y nunca se sobrescriben en una regeneración.
- Cambio de horario de verano → probado con conversión de ida y vuelta en
  9 fechas distintas del año usando el tzdata real del runtime (sin asumir
  qué mes aplica en Chile).
- Descansos dentro de una ventana larga → se reserva el `breakMinutes`
  configurado tras `breakEveryMinutes` de trabajo continuo.
- Determinismo/idempotencia de la función pura → mismo input, mismo output
  exacto.
- Funciona sin ningún proveedor de IA configurado → el motor no importa ni
  llama a `@studyflow/ai-core` en ningún punto.

```
npm run build --workspace=apps/student-web
npm run lint --workspace=apps/student-web
npm run typecheck --workspace=packages/shared
npm run typecheck --workspace=packages/academic-core
```
Los cuatro terminan sin errores (build genera las 17 rutas, incluidas las 4
nuevas bajo `/study/*`).

### Lo que NO se ejecutó (requiere un Supabase real) — instrucciones para reproducirlo

No hay Postgres/Supabase disponible en este entorno de ejecución, y la
tarea pidió explícitamente no aplicar migraciones ni desplegar. Esto
**no se probó**, y no se afirma que pase:

- **Aislamiento entre dos usuarios (RLS)**: crear dos cuentas de prueba,
  generar un plan para cada una, y confirmar con el cliente anon-key (nunca
  service-role) que el usuario A no puede leer/escribir filas de
  `study_profiles`, `availability_*`, `study_plan_items`, `gemini_proposals`
  ni `study_observations` del usuario B, ni pasando su `user_id` a mano.
- **Regeneración sin duplicados bajo concurrencia real**: disparar
  `regeneratePlan()` dos veces en paralelo (doble clic real, no simulado) y
  confirmar en la tabla que existe una sola fila en `study_plans` para
  `(user_id, week_start)` y que `study_plan_items` no tiene filas duplicadas
  — la función `regenerate_study_plan` fue diseñada para esto (upsert +
  `on conflict do nothing` dentro de una sola transacción de Postgres), pero
  esto es una garantía a nivel de función SQL, no algo que un test de
  Vitest pueda ejercitar sin una base real.
- **JSON inválido/excesivo/obsoleto/con `taskId` ajeno** contra la validación
  real: la lógica de `validateGeminiProposal` y el chequeo de staleness en
  `importGeminiProposal` tienen sus reglas escritas y revisadas a mano, pero
  no hay un test automatizado corriendo contra una tabla `gemini_proposals`
  real. Para probarlo manualmente: generar un contexto, cambiar una tarea
  incluida (por ejemplo su `dueAt`), y confirmar que pegar la respuesta
  devuelve el error de "cambiaron desde que exportaste este contexto".

---

## 4. Guía breve para el alumno

1. Ve a **Estudiar** → completa (o salta) **Mi perfil de estudio** y
   **Mi disponibilidad** — sin esto, StudyFlow no sabe cuándo puedes
   estudiar de verdad.
2. Entra a **Mi plan semanal** y presiona **Regenerar plan** — StudyFlow
   arma sesiones concretas para los próximos días, gratis, sin ninguna IA.
3. Marca cada sesión como completada cuando la termines — eso es lo que
   permite que StudyFlow te proponga ajustes más adelante (nunca
   automáticos, siempre los confirmas tú).
4. Si quieres una segunda opinión: entra a **Personalizar con mi Gemini**,
   elige tus tareas, copia el contexto, pégalo en tu propia cuenta de
   Gemini, y trae la respuesta de vuelta — tú decides qué parte incorporar.
5. Si tienes poco tiempo ahora mismo: usa **Tengo X minutos** desde
   Estudiar o el dashboard.

---

## 5. Límites y pendientes

- **`estimateMultiplier` (observación LONGER_ESTIMATES)** se registra como
  aceptada pero no reescribe automáticamente la estimación de tareas
  existentes — aplicar ese multiplicador tarea por tarea queda para un
  flujo de edición de tareas futuro; hoy es informativo.
- **"Elegir un tema de repaso" sin tarea** solo genera un micro-paso de
  texto en pantalla — no crea una tarea ni una sesión real en el plan. Es
  intencional (evita crear registros falsos), pero es una limitación real
  si el alumno esperaba que quedara guardado.
- **El adaptador de servidor para la API de Gemini** (más allá del flujo
  copiar/pegar) no se tocó — ver sección 11 del brief y el roadmap.
- **Notificaciones/recordatorios** de sesiones planificadas no existen
  todavía (tablas de notificaciones ya presentes desde antes, sin job/cron).
- **El diseño responsive** reutiliza los mismos patrones Tailwind ya
  usados en el resto de la app, pero no se verificó visualmente en un
  navegador dado que las páginas requieren una sesión autenticada contra un
  Supabase real — no se afirma que se vea bien en móvil, solo que sigue el
  mismo sistema de diseño.
- **`study_plan_items.is_completed`** (columna original de 2023) queda
  como deprecada pero no se eliminó, para no romper ninguna lectura previa
  que dependiera de ella.

---

## Nota sobre el adaptador de servidor de Gemini (fuera de esta etapa)

`packages/ai-core/src/providers/google.ts` ya existía antes de esta tarea y
no se modificó ni se habilitó por defecto — sigue detrás de la variable
`AI_PROVIDER`, igual que antes. No se implementó ninguna conexión "directa"
a la cuenta Gemini del alumno; el único flujo con Gemini de esta etapa es el
copiar/pegar manual descrito arriba.

Antes de habilitar ese adaptador de servidor para todos los alumnos, hay
que dejar registrado que:

- La API de Gemini tiene cuotas independientes del uso gratuito de
  gemini.google.com — el nivel gratuito de la API puede cambiar sin aviso.
- Tener una API key no demuestra que el proyecto de Google Cloud carezca de
  facturación habilitada — no se puede garantizar costo cero solo por usar
  una clave.
- Antes de habilitarla para estudiantes hay que revisar el tratamiento de
  datos de Google para la API (distinto del de la app de consumo) y las
  restricciones de edad aplicables.
- Ninguna credencial de este adaptador debe aparecer en código público,
  URLs, logs, ni `localStorage` — hoy vive solo en variables de entorno de
  servidor, y así debe seguir.

## 6. Instrucciones de despliegue (Netlify) — no ejecutadas en esta tarea

Cuando el usuario decida aplicar las migraciones y desplegar:

```bash
# 1. Aplicar las migraciones 0018–0024, en orden, en el SQL Editor de Supabase
#    (o `supabase db push` si el CLI está enlazado al proyecto).

# 2. Verificar en local antes de desplegar:
npm run build --workspace=apps/student-web
npm run test --workspace=packages/academic-core

# 3. Desplegar el sitio de estudiantes (ya configurado en netlify.toml):
npx netlify deploy --prod --filter student-web
```

No se requiere ninguna variable de entorno nueva — todo el motor gratuito
corre sin IA, y el flujo de Gemini no usa ninguna API key (es copiar/pegar
manual). Si en el futuro se habilita un adaptador de servidor para Gemini
(sección 11), ese es el momento de revisar cuotas, tratamiento de datos y
las advertencias de costo documentadas ahí — no antes.

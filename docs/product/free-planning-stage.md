# Etapa gratuita de planificación — entrega

Implementación del organizador académico gratuito descrito en el brief:
perfil de estudio, disponibilidad real, motor de plan semanal sin IA,
"Tengo X minutos" con micro-paso, flujo asistido "Personalizar con mi
Gemini", y observaciones de adaptación basadas en reglas.

**Actualización:** a pedido explícito del usuario ("dejalo listo
funcionando"), esto ya fue aplicado y desplegado — ver la sección
"Aplicado a producción" al final de este documento para el detalle real,
incluido un bug que se encontró y corrigió durante la verificación en vivo.

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
Ver sección 2 y "Aplicado a producción" al final — todas las migraciones,
incluida la de corrección `0025`, ya están aplicadas.

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
8. `0025_fix_study_plans_conflict_target.sql` — corrige un bug real
   encontrado en la verificación en vivo (ver "Aplicado a producción"):
   el índice único de `0020` era parcial y Postgres no lo aceptaba como
   objetivo de `ON CONFLICT`. Reemplaza ese índice por uno no parcial.

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

Adicionalmente, ya en producción real (ver "Aplicado a producción"): las 8
migraciones se aplicaron y se verificó en vivo el recorrido completo —
signup → perfil → disponibilidad → generar plan → completar sesión →
generar contexto de Gemini — con una cuenta de prueba que se borró después.

### Lo que sigue sin probarse (requiere un segundo usuario o concurrencia real)

- **Aislamiento entre dos usuarios (RLS)**: crear dos cuentas de prueba,
  generar un plan para cada una, y confirmar con el cliente anon-key (nunca
  service-role) que el usuario A no puede leer/escribir filas de
  `study_profiles`, `availability_*`, `study_plan_items`, `gemini_proposals`
  ni `study_observations` del usuario B, ni pasando su `user_id` a mano.
  Solo se probó con una cuenta a la vez.
- **Regeneración sin duplicados bajo concurrencia real**: disparar
  `regeneratePlan()` dos veces en paralelo (doble clic real, no simulado) y
  confirmar en la tabla que existe una sola fila en `study_plans` para
  `(user_id, week_start)` y que `study_plan_items` no tiene filas duplicadas.
  Se verificó que una sola llamada funciona correctamente en producción
  (incluida la corrección del índice, `0025`); la garantía bajo concurrencia
  real sigue sin probarse con dos requests simultáneos de verdad.
- **JSON inválido/excesivo/obsoleto/con `taskId` ajeno** contra la validación
  real: la lógica de `validateGeminiProposal` y el chequeo de staleness en
  `importGeminiProposal` se verificaron generando un contexto real (ver
  abajo), pero no se probaron deliberadamente los casos de error (JSON roto,
  `taskId` ajeno, contexto obsoleto) contra la base ya en producción.

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

## 6. Despliegue (Netlify)

No se requirió ninguna variable de entorno nueva — todo el motor gratuito
corre sin IA, y el flujo de Gemini no usa ninguna API key (es copiar/pegar
manual). Si en el futuro se habilita un adaptador de servidor para Gemini
(ver más arriba), ese es el momento de revisar cuotas, tratamiento de datos
y las advertencias de costo — no antes.

Comandos usados (para referencia / repetirlo en otro entorno):

```bash
npm run build --workspace=apps/student-web
npm run test --workspace=packages/academic-core
npx netlify deploy --prod --filter student-web
```

---

## Aplicado a producción

A pedido explícito del usuario, esto se aplicó y desplegó de verdad — no
quedó solo en el working tree. Resumen de lo que pasó:

1. **Migraciones 0018–0024** aplicadas en orden en el SQL Editor de
   Supabase (proyecto `studyflow-ai`, tabla por tabla, verificando en cada
   paso el largo exacto en bytes del texto pegado contra el archivo local
   antes de ejecutar, para descartar corrupción del portapapeles).

2. **Bug real encontrado en vivo**: al probar "Regenerar plan" desde la
   app, Postgres devolvió `there is no unique or exclusion constraint
   matching the ON CONFLICT specification`. Causa: `0020` creó
   `study_plans_user_week_idx` como índice **parcial**
   (`where week_start is not null`), y `ON CONFLICT (user_id, week_start)`
   en `regenerate_study_plan()` no repetía ese mismo predicado — Postgres
   exige que coincidan exactamente para usar un índice parcial como
   destino de conflicto. Como `week_start` siempre lo pone la propia
   función (nunca es null en la práctica), la corrección fue reemplazar el
   índice por uno no parcial. Migración `0025_fix_study_plans_conflict_target.sql`,
   aplicada y verificada en el mismo entorno.

3. **Verificación end-to-end en producción real**, con una cuenta de
   prueba (`qa-verify-planning@example.com`, borrada al terminar):
   - Registro sin confirmación de correo (comportamiento ya vigente).
   - `/study/profile`: guardado real de objetivo, método de explicación y
     duración de sesión — mensaje "Perfil guardado" confirmado.
   - `/study/availability`: bloque semanal "Tiempo para estudiar, lunes
     18:00–20:00" guardado y listado.
   - Tarea real creada ("Repasar límites y derivadas", 60 min).
   - `/study/plan` → "Regenerar plan de la semana": generó **Parte 1/2** y
     **Parte 2/2** de la tarea, 18:00–18:30 y 18:30–19:00 del lunes
     siguiente, respetando la duración de sesión (30 min) declarada en el
     perfil.
   - "Marcar completada" en la Parte 1/2: formulario completo (minutos
     reales, estado del objetivo, comprensión, dificultad, método,
     comprobación, comentario) guardó correctamente — la sesión quedó
     tachada y no se pierde al regenerar.
   - `/study/gemini`: "Generar contexto" produjo el JSON real
     (`schemaVersion`, `studentGoal`, `preferences`, `tasks` con el
     `taskId` real) y quedó registrado en `gemini_proposals`.

4. **Deploy**: `apps/student-web` publicado en
   https://studyflow-ai-188.netlify.app (build limpio, sin warnings).

5. **Commit**: `Add free study-planning stage: profile, availability,
   weekly plan engine, Gemini-assisted flow` (más el commit de la
   corrección `0025`), pusheado a `main`.

Lo que **no** se verificó en vivo (ver sección 3): aislamiento RLS entre
dos usuarios reales simultáneos, y una regeneración de plan disparada dos
veces en paralelo de verdad (concurrencia real, no solo una llamada).

# Roadmap

> Actualizado en septiembre de 2026. La dirección y los criterios de prioridad
> están en [`product-direction-2026.md`](product-direction-2026.md).

## Fase 1 — MVP (implementado en este pase)

Auth, perfil, institución/carrera/semestre/asignaturas, dashboard, tareas
manuales, StudyFlow Inbox (texto), calendario, sesiones de estudio,
Founder admin, roles, entitlements, licencias gratuitas, feature flags,
esquema Supabase + RLS, landing, PWA.

## Funciones incorporadas después del MVP

- Inbox desde texto y foto con confirmación manual y fallback por reglas.
- Calendario mensual interactivo, quick-add y sincronización por ICS.
- Materiales con subida múltiple y opción de compartir por asignatura.
- Colaboración en tareas mediante invitaciones y enlaces reales.
- PWA instalable en Android y iOS/iPad.
- **Etapa gratuita de planificación** (código listo, migraciones sin aplicar
  — ver [`free-planning-stage.md`](free-planning-stage.md)): perfil de
  estudio editable, disponibilidad real con excepciones, motor gratuito de
  plan semanal en `packages/academic-core` (sin IA), "Tengo X minutos" con
  micro-paso concreto, flujo asistido "Personalizar con mi Gemini"
  (copiar/pegar manual, sin scraping ni OAuth), y observaciones de
  adaptación basadas en reglas transparentes.

## Próxima etapa — Activación y hábito

- Alinear la landing con las funciones disponibles.
- Reducir el tiempo desde el registro hasta la primera captura confirmada.
- Convertir el dashboard en una recomendación principal explicable.
- Medir primera captura, primera tarea completada y retención a 7/28 días.
- Validar uso recurrente antes de añadir otra superficie de producto.

## IA aplicada

- Subida de documentos (PDF/DOCX/PPTX/TXT) → extracción de texto → chunks
  → embeddings → RAG real (tablas `course_materials`/`material_chunks` ya
  existen; falta el pipeline de ingesta y el endpoint de chat con fuentes).
- "Lo dijo el profesor" (audio) — falta transcripción + extracción.
- Tutor con IA (`ai_conversations`/`ai_messages` ya existen).
- Notificaciones (tablas listas; falta el job/cron que las dispare).
- Adaptador de servidor para la API de Gemini (más allá del flujo asistido
  copiar/pegar) — deliberadamente no habilitado esta etapa, ver
  `free-planning-stage.md` sección 11.

## Mobile, sujeto a evidencia de uso

Flutter (`apps/mobile`), push notifications (FCM/APNs), widgets nativos,
captura de audio en mobile.

## Integraciones autorizadas

Correo y calendarios con OAuth registrado. Una integración institucional se
evaluará solo con autorización formal; nunca se solicitarán credenciales del
portal al estudiante.

## StudyFlow Campus, después de validar el producto individual

Panel institucional, analíticas agregadas y anonimizadas, licenciamiento
formal (`licenses`, `institution_contracts` ya existen en el esquema).

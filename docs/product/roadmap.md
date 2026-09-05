# Roadmap

## Fase 1 — MVP (implementado en este pase)

Auth, perfil, institución/carrera/semestre/asignaturas, dashboard, tareas
manuales, StudyFlow Inbox (texto), calendario, sesiones de estudio,
Founder admin, roles, entitlements, licencias gratuitas, feature flags,
esquema Supabase + RLS, landing, PWA.

## Fase 2 — Documentos e IA aplicada

- Subida de documentos (PDF/DOCX/PPTX/TXT) → extracción de texto → chunks
  → embeddings → RAG real (tablas `course_materials`/`material_chunks` ya
  existen; falta el pipeline de ingesta y el endpoint de chat con fuentes).
- Fotos de pizarra (`inbox_items.type = WHITEBOARD_PHOTO`, tabla ya
  soporta `raw_storage_path`; falta el flujo de captura + OCR/vision).
- "Lo dijo el profesor" (audio) — falta transcripción + extracción.
- Tutor con IA (`ai_conversations`/`ai_messages` ya existen).
- Planificador inteligente completo (hoy solo existe el motor de prioridad
  y la recomendación por tiempo disponible; falta la vista de plan semanal
  automático usando `study_plans`/`study_plan_items`).
- Notificaciones (tablas listas; falta el job/cron que las dispare).

## Fase 3 — Mobile

Flutter (`apps/mobile`), push notifications (FCM/APNs), widgets nativos,
captura de audio en mobile.

## Fase 4 — Integraciones

Correo, calendarios (Google/Microsoft), Blackboard (ver
`docs/duoc-integration/`).

## Fase 5 — StudyFlow Campus

Panel institucional, analíticas agregadas y anonimizadas, licenciamiento
formal (`licenses`, `institution_contracts` ya existen en el esquema).

-- StudyFlow AI — Demo seed data (fictional, no private real data)
-- Run after migrations: supabase db reset (applies migrations + this seed)

insert into plans (key, name, description, price_monthly_usd, price_annual_usd, features) values
  ('FREE', 'StudyFlow Free', 'Organiza tus asignaturas, horario y tareas manuales.', 0, 0,
    '{"ai_generations_per_day": 0, "storage_mb": 100, "ai_chat": false}'),
  ('PRO', 'StudyFlow Pro', 'IA ilimitada, planificador inteligente y tutor con tus materiales.', 9.99, 89.99,
    '{"ai_generations_per_day": null, "storage_mb": 10240, "ai_chat": true, "smart_planner": true}'),
  ('CAMPUS', 'StudyFlow Campus', 'Licenciamiento institucional con analíticas agregadas.', null, null,
    '{"ai_generations_per_day": null, "storage_mb": 102400, "ai_chat": true, "smart_planner": true, "institutional_analytics": true}')
on conflict (key) do nothing;

insert into feature_flags (key, description, enabled_globally) values
  ('AI_TUTOR', 'Chat con IA sobre los materiales del estudiante', true),
  ('AUDIO_CAPTURE', 'Módulo "Lo dijo el profesor" (grabación/transcripción de audio)', false),
  ('BLACKBOARD_SYNC', 'Sincronización oficial con Blackboard (requiere autorización institucional)', false),
  ('SMART_PLANNER', 'Planificador inteligente basado en prioridad', true),
  ('EXAM_MODE', 'Modo de preparación de evaluaciones', true),
  ('NEW_DASHBOARD', 'Dashboard rediseñado', true)
on conflict (key) do nothing;

-- Demo institution (fictional, for onboarding/testing — not a real Duoc integration)
insert into institutions (id, name, slug, is_pilot) values
  ('00000000-0000-0000-0000-000000000001', 'Institución Demo', 'institucion-demo', true)
on conflict (id) do nothing;

insert into careers (id, institution_id, name) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ingeniería en Marketing Digital')
on conflict (id) do nothing;

insert into academic_periods (id, institution_id, career_id, name, is_current) values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '2026-2', true)
on conflict (id) do nothing;

insert into subjects (id, institution_id, academic_period_id, career_id, name, code, color) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Analítica Digital', 'MKT201', '#7C3AED'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Marketing Estratégico', 'MKT202', '#4F46E5'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Investigación de Mercado', 'MKT203', '#10B981'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'E-commerce', 'MKT204', '#F59E0B')
on conflict (id) do nothing;

-- Note: demo tasks are intentionally NOT seeded here because tasks require a
-- real auth.users row (user_id FK). apps/student-web ships a "load demo data"
-- action for freshly onboarded demo accounts instead — see docs/product/demo-data.md.

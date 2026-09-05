-- StudyFlow AI — Calendar & Study Planner

create type calendar_event_type as enum (
  'CLASS', 'TASK', 'EVALUATION', 'STUDY_SESSION', 'REMINDER', 'CUSTOM'
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type calendar_event_type not null default 'CUSTOM',
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  task_id uuid references tasks (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  created_at timestamptz not null default now()
);

create index calendar_events_user_id_idx on calendar_events (user_id);
create index calendar_events_starts_at_idx on calendar_events (starts_at);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  task_id uuid references tasks (id) on delete set null,
  subject_id uuid references subjects (id) on delete set null,
  goal text,
  planned_minutes int,
  actual_minutes int,
  outcome_notes text, -- answers "¿Qué lograste?"
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index study_sessions_user_id_idx on study_sessions (user_id);
create index study_sessions_task_id_idx on study_sessions (task_id);

create table study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create index study_plans_user_id_idx on study_plans (user_id);

create table study_plan_items (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references study_plans (id) on delete cascade,
  task_id uuid references tasks (id) on delete cascade,
  scheduled_date date not null,
  scheduled_minutes int,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index study_plan_items_study_plan_id_idx on study_plan_items (study_plan_id);

alter table calendar_events enable row level security;
alter table study_sessions enable row level security;
alter table study_plans enable row level security;
alter table study_plan_items enable row level security;

create policy calendar_events_owner_only on calendar_events
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy study_sessions_owner_only on study_sessions
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy study_plans_owner_only on study_plans
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy study_plan_items_owner_only on study_plan_items
  for all using (exists (select 1 from study_plans p where p.id = study_plan_id and (p.user_id = auth.uid() or is_staff())))
  with check (exists (select 1 from study_plans p where p.id = study_plan_id and (p.user_id = auth.uid() or is_staff())));

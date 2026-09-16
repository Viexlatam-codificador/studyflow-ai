-- ============================================================
-- STUDYFLOW AI — combined setup script
-- Generated from supabase/migrations/*.sql + supabase/seed/seed.sql
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- ============================================================

-- ============================================================
-- supabase/migrations/0001_extensions.sql
-- ============================================================
-- StudyFlow AI — Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

-- ============================================================
-- supabase/migrations/0002_identity_and_roles.sql
-- ============================================================
-- StudyFlow AI — Identity, RBAC, Founder/Owner bootstrap
-- Principle: owner protection and role checks are enforced in the database,
-- never trusted from client input alone.

create type app_role as enum (
  'OWNER',
  'SUPER_ADMIN',
  'INSTITUTION_ADMIN',
  'PROFESSOR',
  'SUPPORT',
  'STUDENT_PRO',
  'STUDENT_FREE'
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  owner_locked boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on profiles (email);

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Prevent anyone but service_role from ever un-locking an owner profile.
create function protect_owner_lock() returns trigger as $$
begin
  if old.owner_locked = true and new.owner_locked = false and auth.role() <> 'service_role' then
    raise exception 'owner_locked cannot be removed';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger profiles_protect_owner_lock
  before update on profiles
  for each row execute function protect_owner_lock();

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  role app_role not null,
  institution_id uuid, -- FK added in 0003 once institutions exists
  granted_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (user_id, role, institution_id)
);

create index user_roles_user_id_idx on user_roles (user_id);

-- OWNER rows are immutable once granted: no update, no delete, except by
-- service_role (i.e. a deliberate backend/DB operation, never end-user traffic).
create function protect_owner_role() returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and old.role = 'OWNER' then
    raise exception 'OWNER role cannot be revoked';
  end if;
  if tg_op = 'UPDATE' and old.role = 'OWNER' and new.role <> 'OWNER' then
    raise exception 'OWNER role cannot be changed';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger user_roles_protect_owner
  before update or delete on user_roles
  for each row execute function protect_owner_role();

-- ---------------------------------------------------------------------------
-- Helper functions used throughout RLS policies
-- ---------------------------------------------------------------------------
create function has_role(check_role app_role, check_institution_id uuid default null)
returns boolean as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role = check_role
      and (check_institution_id is null or institution_id = check_institution_id or institution_id is null)
  );
$$ language sql stable security definer set search_path = public;

create function is_owner() returns boolean as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'OWNER'
  );
$$ language sql stable security definer set search_path = public;

create function is_staff() returns boolean as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role in ('OWNER', 'SUPER_ADMIN', 'SUPPORT')
  );
$$ language sql stable security definer set search_path = public;

create function is_institution_admin(check_institution_id uuid) returns boolean as $$
  select is_owner() or exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role in ('SUPER_ADMIN', 'INSTITUTION_ADMIN')
      and (institution_id = check_institution_id or institution_id is null)
  );
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup + bootstrap OWNER on verified email match
-- ---------------------------------------------------------------------------
create table platform_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into platform_config (key, value) values
  ('owner_bootstrap_email', 'viexlatam@gmail.com');

create function handle_new_auth_user() returns trigger as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', null))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

create function bootstrap_owner_on_verified_email() returns trigger as $$
declare
  bootstrap_email text;
begin
  select value into bootstrap_email from platform_config where key = 'owner_bootstrap_email';

  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null)
     and lower(new.email) = lower(bootstrap_email) then

    update profiles set owner_locked = true where id = new.id;

    insert into user_roles (user_id, role, granted_by)
    values (new.id, 'OWNER', new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_email_verified
  after update of email_confirmed_at on auth.users
  for each row execute function bootstrap_owner_on_verified_email();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table platform_config enable row level security;

create policy profiles_select_own_or_staff on profiles
  for select using (id = auth.uid() or is_staff());

create policy profiles_update_own on profiles
  for update using (id = auth.uid() or is_staff());

create policy profiles_insert_service_only on profiles
  for insert with check (auth.role() = 'service_role' or id = auth.uid());

create policy user_roles_select_own_or_staff on user_roles
  for select using (user_id = auth.uid() or is_staff());

create policy user_roles_write_staff_only on user_roles
  for insert with check (is_owner() or has_role('SUPER_ADMIN'));

create policy user_roles_update_staff_only on user_roles
  for update using (is_owner() or has_role('SUPER_ADMIN'));

create policy user_roles_delete_staff_only on user_roles
  for delete using (is_owner() or has_role('SUPER_ADMIN'));

create policy platform_config_owner_only on platform_config
  for all using (is_owner()) with check (is_owner());

-- ============================================================
-- supabase/migrations/0003_institutions.sql
-- ============================================================
-- StudyFlow AI — Multi-institution hierarchy
-- Institution -> Campus -> Career -> Academic Period
-- StudyFlow must never hardcode a specific institution (e.g. Duoc UC).

create table institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  is_pilot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger institutions_set_updated_at
  before update on institutions
  for each row execute function set_updated_at();

alter table user_roles
  add constraint user_roles_institution_id_fkey
  foreign key (institution_id) references institutions (id) on delete cascade;

create table campuses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create index campuses_institution_id_idx on campuses (institution_id);

create table careers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  campus_id uuid references campuses (id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);

create index careers_institution_id_idx on careers (institution_id);

create table academic_periods (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  career_id uuid references careers (id) on delete set null,
  name text not null, -- e.g. "2026-2"
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create index academic_periods_institution_id_idx on academic_periods (institution_id);

-- Student's own enrollment context (which institution/career/period they belong to)
create table student_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  institution_id uuid not null references institutions (id) on delete cascade,
  campus_id uuid references campuses (id) on delete set null,
  career_id uuid references careers (id) on delete set null,
  academic_period_id uuid references academic_periods (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index student_enrollments_user_id_idx on student_enrollments (user_id);

alter table institutions enable row level security;
alter table campuses enable row level security;
alter table careers enable row level security;
alter table academic_periods enable row level security;
alter table student_enrollments enable row level security;

-- Institutions/campuses/careers/periods are readable by any authenticated user
-- (needed for onboarding pickers); writes are restricted to staff/institution admins.
create policy institutions_select_authenticated on institutions
  for select using (auth.role() = 'authenticated');

create policy institutions_write_staff on institutions
  for all using (is_owner() or has_role('SUPER_ADMIN'))
  with check (is_owner() or has_role('SUPER_ADMIN'));

create policy campuses_select_authenticated on campuses
  for select using (auth.role() = 'authenticated');

create policy campuses_write_institution_admin on campuses
  for all using (is_institution_admin(institution_id))
  with check (is_institution_admin(institution_id));

create policy careers_select_authenticated on careers
  for select using (auth.role() = 'authenticated');

create policy careers_write_institution_admin on careers
  for all using (is_institution_admin(institution_id))
  with check (is_institution_admin(institution_id));

create policy academic_periods_select_authenticated on academic_periods
  for select using (auth.role() = 'authenticated');

create policy academic_periods_write_institution_admin on academic_periods
  for all using (is_institution_admin(institution_id))
  with check (is_institution_admin(institution_id));

create policy student_enrollments_owner_or_self on student_enrollments
  for select using (user_id = auth.uid() or is_institution_admin(institution_id) or is_staff());

create policy student_enrollments_write_self on student_enrollments
  for insert with check (user_id = auth.uid());

create policy student_enrollments_update_self on student_enrollments
  for update using (user_id = auth.uid() or is_institution_admin(institution_id));

create policy student_enrollments_delete_self on student_enrollments
  for delete using (user_id = auth.uid() or is_institution_admin(institution_id));

-- ============================================================
-- supabase/migrations/0004_academic_structure.sql
-- ============================================================
-- StudyFlow AI — Subjects, classes, materials, announcements

create table subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  academic_period_id uuid references academic_periods (id) on delete set null,
  career_id uuid references careers (id) on delete set null,
  name text not null,
  code text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subjects_institution_id_idx on subjects (institution_id);

create trigger subjects_set_updated_at
  before update on subjects
  for each row execute function set_updated_at();

create type subject_member_role as enum ('STUDENT', 'PROFESSOR');

create table subject_members (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role subject_member_role not null default 'STUDENT',
  created_at timestamptz not null default now(),
  unique (subject_id, user_id)
);

create index subject_members_user_id_idx on subject_members (user_id);
create index subject_members_subject_id_idx on subject_members (subject_id);

create function is_subject_member(check_subject_id uuid) returns boolean as $$
  select exists (
    select 1 from subject_members
    where subject_id = check_subject_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create table professors (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  user_id uuid references profiles (id) on delete set null,
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

create index professors_institution_id_idx on professors (institution_id);

create table classes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  professor_id uuid references professors (id) on delete set null,
  day_of_week smallint check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  location text,
  modality text default 'ON_SITE',
  created_at timestamptz not null default now()
);

create index classes_subject_id_idx on classes (subject_id);

create table class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  session_date date not null,
  topic text,
  notes text,
  created_at timestamptz not null default now()
);

create index class_sessions_subject_id_idx on class_sessions (subject_id);
create index class_sessions_session_date_idx on class_sessions (session_date);

create type material_visibility as enum ('PRIVATE', 'SUBJECT');

create table course_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  institution_id uuid references institutions (id) on delete set null,
  academic_period_id uuid references academic_periods (id) on delete set null,
  title text not null,
  file_type text,
  storage_path text not null,
  visibility material_visibility not null default 'PRIVATE',
  extracted_text_status text default 'PENDING', -- PENDING | PROCESSING | READY | FAILED
  created_at timestamptz not null default now()
);

create index course_materials_user_id_idx on course_materials (user_id);
create index course_materials_subject_id_idx on course_materials (subject_id);

-- RAG chunks + embeddings, populated by the document-processing pipeline
create table material_chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references course_materials (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index material_chunks_material_id_idx on material_chunks (material_id);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  posted_by uuid references profiles (id) on delete set null,
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

create index announcements_subject_id_idx on announcements (subject_id);

alter table subjects enable row level security;
alter table subject_members enable row level security;
alter table professors enable row level security;
alter table classes enable row level security;
alter table class_sessions enable row level security;
alter table course_materials enable row level security;
alter table material_chunks enable row level security;
alter table announcements enable row level security;

create policy subjects_select_member_or_admin on subjects
  for select using (is_subject_member(id) or is_institution_admin(institution_id) or is_staff());

create policy subjects_write_admin on subjects
  for all using (is_institution_admin(institution_id))
  with check (is_institution_admin(institution_id));

create policy subject_members_select on subject_members
  for select using (user_id = auth.uid() or is_subject_member(subject_id) or is_staff());

create policy subject_members_insert_self on subject_members
  for insert with check (user_id = auth.uid());

create policy subject_members_delete_self_or_admin on subject_members
  for delete using (user_id = auth.uid() or is_staff());

create policy professors_select_authenticated on professors
  for select using (auth.role() = 'authenticated');

create policy professors_write_admin on professors
  for all using (is_institution_admin(institution_id))
  with check (is_institution_admin(institution_id));

create policy classes_select_member on classes
  for select using (is_subject_member(subject_id) or is_staff());

create policy classes_write_admin on classes
  for all using (is_staff()) with check (is_staff());

create policy class_sessions_select_member on class_sessions
  for select using (is_subject_member(subject_id) or is_staff());

create policy class_sessions_write_admin on class_sessions
  for all using (is_staff()) with check (is_staff());

-- Materials: strictly owner-only unless explicitly shared to the subject.
create policy course_materials_select_owner_or_shared on course_materials
  for select using (
    user_id = auth.uid()
    or (visibility = 'SUBJECT' and is_subject_member(subject_id))
    or is_staff()
  );

create policy course_materials_write_owner on course_materials
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy material_chunks_select_owner on material_chunks
  for select using (user_id = auth.uid() or is_staff());

create policy material_chunks_write_owner on material_chunks
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy announcements_select_member on announcements
  for select using (is_subject_member(subject_id) or is_staff());

create policy announcements_write_staff on announcements
  for all using (is_staff()) with check (is_staff());

-- ============================================================
-- supabase/migrations/0005_tasks_and_evaluations.sql
-- ============================================================
-- StudyFlow AI — Tasks (planner backbone), Inbox, Assignments, Evaluations

create type task_source as enum (
  'MANUAL', 'CLASS_TEXT', 'CLASS_AUDIO', 'WHITEBOARD_PHOTO', 'DOCUMENT',
  'EMAIL', 'BLACKBOARD', 'CALENDAR', 'PROFESSOR', 'SYSTEM'
);

create type task_status as enum (
  'NEW', 'PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'SUBMITTED', 'OVERDUE'
);

-- The generic planner item. Every actionable thing in StudyFlow (manual task,
-- something extracted from the Inbox, an assignment/evaluation reminder)
-- surfaces here so the dashboard, calendar and priority engine have one shape.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  institution_id uuid references institutions (id) on delete set null,
  subject_id uuid references subjects (id) on delete set null,
  title text not null,
  description text,
  professor_id uuid references professors (id) on delete set null,
  due_at timestamptz,
  starts_at timestamptz,
  estimated_minutes int,
  difficulty smallint check (difficulty between 1 and 5),
  priority_score numeric(5,2) check (priority_score between 0 and 100),
  grade_weight numeric(5,2),
  status task_status not null default 'NEW',
  progress_percentage smallint not null default 0 check (progress_percentage between 0 and 100),
  instructions text,
  source task_source not null default 'MANUAL',
  source_url text,
  external_id text,
  confidence numeric(3,2), -- AI extraction confidence, 0..1
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_idx on tasks (user_id);
create index tasks_due_at_idx on tasks (due_at);
create index tasks_subject_id_idx on tasks (subject_id);
create index tasks_status_idx on tasks (status);

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

create table task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index task_subtasks_task_id_idx on task_subtasks (task_id);

create table task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  storage_path text not null,
  file_type text,
  created_at timestamptz not null default now()
);

create index task_attachments_task_id_idx on task_attachments (task_id);

-- ---------------------------------------------------------------------------
-- StudyFlow Inbox: raw capture before AI extraction is confirmed.
-- Nothing here becomes a `task` until the user confirms (see section 9 rules).
-- ---------------------------------------------------------------------------
create type inbox_item_type as enum (
  'TEXT', 'WHITEBOARD_PHOTO', 'PROFESSOR_AUDIO', 'DOCUMENT', 'EVALUATION', 'EVENT', 'REMINDER'
);

create type inbox_item_status as enum ('PENDING_REVIEW', 'CONFIRMED', 'DISCARDED');

create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type inbox_item_type not null,
  raw_input text,
  raw_storage_path text,
  ai_extraction jsonb,
  confidence numeric(3,2),
  status inbox_item_status not null default 'PENDING_REVIEW',
  resulting_task_id uuid references tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index inbox_items_user_id_idx on inbox_items (user_id);
create index inbox_items_status_idx on inbox_items (status);

-- ---------------------------------------------------------------------------
-- Assignments (trabajos) — richer record than a bare task, optionally linked
-- to a `tasks` row so it also appears in the unified planner.
-- ---------------------------------------------------------------------------
create table assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks (id) on delete set null,
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  title text not null,
  description text,
  is_group_work boolean not null default false,
  due_at timestamptz,
  status task_status not null default 'NEW',
  created_at timestamptz not null default now()
);

create index assignments_user_id_idx on assignments (user_id);
create index assignments_subject_id_idx on assignments (subject_id);

create table assignment_files (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  uploaded_by uuid references profiles (id) on delete set null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index assignment_files_assignment_id_idx on assignment_files (assignment_id);

-- ---------------------------------------------------------------------------
-- Evaluations (pruebas/exámenes/presentaciones), rubrics, grades
-- ---------------------------------------------------------------------------
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks (id) on delete set null,
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  title text not null,
  evaluation_type text, -- QUIZ | EXAM | PROJECT | PRESENTATION | OTHER
  date timestamptz,
  weight_percentage numeric(5,2),
  created_at timestamptz not null default now()
);

create index evaluations_user_id_idx on evaluations (user_id);
create index evaluations_subject_id_idx on evaluations (subject_id);

create table rubrics (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations (id) on delete cascade,
  criteria jsonb not null default '[]',
  max_score numeric(6,2),
  created_at timestamptz not null default now()
);

create table grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  evaluation_id uuid references evaluations (id) on delete cascade,
  assignment_id uuid references assignments (id) on delete cascade,
  score numeric(6,2),
  max_score numeric(6,2),
  feedback text,
  created_at timestamptz not null default now(),
  constraint grades_target_check check (
    (evaluation_id is not null and assignment_id is null) or
    (evaluation_id is null and assignment_id is not null)
  )
);

create index grades_user_id_idx on grades (user_id);

alter table tasks enable row level security;
alter table task_subtasks enable row level security;
alter table task_attachments enable row level security;
alter table inbox_items enable row level security;
alter table assignments enable row level security;
alter table assignment_files enable row level security;
alter table evaluations enable row level security;
alter table rubrics enable row level security;
alter table grades enable row level security;

-- Strict owner isolation: user A can never see user B's tasks.
create policy tasks_owner_only on tasks
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy task_subtasks_owner_only on task_subtasks
  for all using (exists (select 1 from tasks t where t.id = task_id and (t.user_id = auth.uid() or is_staff())))
  with check (exists (select 1 from tasks t where t.id = task_id and (t.user_id = auth.uid() or is_staff())));

create policy task_attachments_owner_only on task_attachments
  for all using (exists (select 1 from tasks t where t.id = task_id and (t.user_id = auth.uid() or is_staff())))
  with check (exists (select 1 from tasks t where t.id = task_id and (t.user_id = auth.uid() or is_staff())));

create policy inbox_items_owner_only on inbox_items
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy assignments_owner_only on assignments
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy assignment_files_owner_only on assignment_files
  for all using (exists (select 1 from assignments a where a.id = assignment_id and (a.user_id = auth.uid() or is_staff())))
  with check (exists (select 1 from assignments a where a.id = assignment_id and (a.user_id = auth.uid() or is_staff())));

create policy evaluations_owner_only on evaluations
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy rubrics_owner_only on rubrics
  for all using (exists (select 1 from evaluations e where e.id = evaluation_id and (e.user_id = auth.uid() or is_staff())))
  with check (exists (select 1 from evaluations e where e.id = evaluation_id and (e.user_id = auth.uid() or is_staff())));

create policy grades_owner_only on grades
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- ============================================================
-- supabase/migrations/0006_calendar_and_study.sql
-- ============================================================
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

-- ============================================================
-- supabase/migrations/0007_notifications.sql
-- ============================================================
-- StudyFlow AI — Notifications

create type notification_type as enum (
  'DUE_SOON_7D', 'DUE_SOON_5D', 'DUE_SOON_3D', 'DUE_TOMORROW',
  'DUE_HIGH_PRIORITY_6H', 'DUE_LAST_CALL_1H', 'DAILY_SUMMARY', 'SYSTEM'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  task_id uuid references tasks (id) on delete cascade,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id);
create index notifications_read_at_idx on notifications (read_at);

create table notification_preferences (
  user_id uuid primary key references profiles (id) on delete cascade,
  due_soon_7d boolean not null default true,
  due_soon_5d boolean not null default true,
  due_soon_3d boolean not null default true,
  due_tomorrow boolean not null default true,
  high_priority_6h boolean not null default true,
  last_call_1h boolean not null default true,
  daily_summary boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on notification_preferences
  for each row execute function set_updated_at();

alter table notifications enable row level security;
alter table notification_preferences enable row level security;

create policy notifications_owner_only on notifications
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy notification_preferences_owner_only on notification_preferences
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- ============================================================
-- supabase/migrations/0008_ai.sql
-- ============================================================
-- StudyFlow AI — AI conversations, messages, usage/cost tracking

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  task_id uuid references tasks (id) on delete set null,
  title text,
  created_at timestamptz not null default now()
);

create index ai_conversations_user_id_idx on ai_conversations (user_id);

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb, -- RAG source citations shown to the user
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_id_idx on ai_messages (conversation_id);

-- Every AI call is logged here for cost tracking and the founder AI-usage dashboard.
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  provider text not null, -- openai | anthropic | google
  model text not null,
  feature text not null, -- e.g. INBOX_EXTRACTION, TUTOR_CHAT, PLANNER, EXAM_PREP
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_user_id_idx on ai_usage (user_id);
create index ai_usage_created_at_idx on ai_usage (created_at);

alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_usage enable row level security;

create policy ai_conversations_owner_only on ai_conversations
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy ai_messages_owner_only on ai_messages
  for all using (exists (select 1 from ai_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or is_staff())))
  with check (exists (select 1 from ai_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or is_staff())));

create policy ai_usage_owner_or_staff on ai_usage
  for select using (user_id = auth.uid() or is_staff());

create policy ai_usage_insert_service on ai_usage
  for insert with check (auth.role() = 'service_role' or user_id = auth.uid());

-- ============================================================
-- supabase/migrations/0009_integrations.sql
-- ============================================================
-- StudyFlow AI — External integrations (Blackboard, email, calendars)
-- Nothing here is activated until the institution grants official OAuth access.
-- See docs/duoc-integration/.

create type integration_type as enum (
  'BLACKBOARD', 'EMAIL', 'GOOGLE_CALENDAR', 'MICROSOFT_CALENDAR', 'MANUAL', 'OTHER_LMS'
);

create type integration_status as enum ('DISCONNECTED', 'PENDING_AUTH', 'CONNECTED', 'ERROR');

create table integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  institution_id uuid references institutions (id) on delete set null,
  type integration_type not null,
  status integration_status not null default 'DISCONNECTED',
  external_account_id text,
  -- OAuth tokens are never stored in plaintext client-readable columns;
  -- this column is only ever written/read by server-side code using the
  -- service_role key, and RLS below blocks client select on it entirely
  -- at the application layer (clients must go through an API route).
  encrypted_credentials text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index integrations_user_id_idx on integrations (user_id);

create trigger integrations_set_updated_at
  before update on integrations
  for each row execute function set_updated_at();

create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations (id) on delete cascade,
  status text not null, -- SUCCESS | FAILED | PARTIAL
  items_synced int not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index sync_logs_integration_id_idx on sync_logs (integration_id);

alter table integrations enable row level security;
alter table sync_logs enable row level security;

create policy integrations_owner_only on integrations
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy sync_logs_owner_only on sync_logs
  for all using (exists (select 1 from integrations i where i.id = integration_id and (i.user_id = auth.uid() or is_staff())))
  with check (exists (select 1 from integrations i where i.id = integration_id and (i.user_id = auth.uid() or is_staff())));

-- ============================================================
-- supabase/migrations/0010_billing.sql
-- ============================================================
-- StudyFlow AI — Plans, subscriptions, entitlements, licenses, payments
-- Never `premium = true`. Access is always derived from entitlements, which
-- are recomputed from subscriptions + license_grants + OWNER status.

create type subscription_source as enum (
  'COMPLIMENTARY', 'PILOT', 'SCHOLARSHIP', 'LIFETIME', 'MONTHLY', 'ANNUAL', 'INSTITUTIONAL'
);

create type subscription_status as enum ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED');

create table plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- FREE | PRO | CAMPUS
  name text not null,
  description text,
  price_monthly_usd numeric(10,2),
  price_annual_usd numeric(10,2),
  features jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  plan_id uuid not null references plans (id),
  status subscription_status not null default 'ACTIVE',
  source subscription_source not null default 'MONTHLY',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  institution_contract_id uuid, -- FK added below after institution_contracts exists
  granted_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_id_idx on subscriptions (user_id);

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

create type entitlement_status as enum ('COMPLIMENTARY', 'PILOT', 'SCHOLARSHIP', 'LIFETIME', 'MONTHLY', 'ANNUAL', 'INSTITUTIONAL', 'NONE');

-- Denormalized, always-current "what can this user do" cache.
create table entitlements (
  user_id uuid primary key references profiles (id) on delete cascade,
  plan_key text not null default 'FREE',
  status entitlement_status not null default 'NONE',
  source_subscription_id uuid references subscriptions (id) on delete set null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table licenses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  plan_id uuid not null references plans (id),
  seats_total int not null default 0,
  seats_used int not null default 0,
  valid_from date,
  valid_until date,
  status text not null default 'ACTIVE', -- ACTIVE | EXPIRED | REVOKED
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index licenses_institution_id_idx on licenses (institution_id);

create table license_grants (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  granted_by uuid references profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (license_id, user_id)
);

create index license_grants_user_id_idx on license_grants (user_id);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plan_id uuid references plans (id),
  discount_percentage numeric(5,2),
  max_redemptions int,
  redeemed_count int not null default 0,
  valid_until date,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  subscription_id uuid references subscriptions (id) on delete set null,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  status text not null, -- SUCCEEDED | FAILED | REFUNDED | PENDING
  provider text not null default 'mock', -- matches BillingProvider abstraction
  provider_reference text,
  created_at timestamptz not null default now()
);

create index payments_user_id_idx on payments (user_id);

create table billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table institution_contracts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  plan_id uuid not null references plans (id),
  seats int not null default 0,
  starts_on date,
  ends_on date,
  status text not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now()
);

alter table subscriptions
  add constraint subscriptions_institution_contract_id_fkey
  foreign key (institution_contract_id) references institution_contracts (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Entitlement recomputation
-- ---------------------------------------------------------------------------
create function recompute_entitlement(target_user_id uuid) returns void as $$
declare
  active_sub record;
  active_grant record;
  resolved_plan_key text := 'FREE';
  resolved_status entitlement_status := 'NONE';
  resolved_expires timestamptz := null;
  resolved_sub_id uuid := null;
begin
  if exists (select 1 from user_roles where user_id = target_user_id and role = 'OWNER') then
    insert into entitlements (user_id, plan_key, status, source_subscription_id, expires_at, updated_at)
    values (target_user_id, 'CAMPUS', 'LIFETIME', null, null, now())
    on conflict (user_id) do update
      set plan_key = excluded.plan_key, status = excluded.status,
          source_subscription_id = null, expires_at = null, updated_at = now();
    return;
  end if;

  select s.id, s.source, s.current_period_end, p.key
    into active_sub
    from subscriptions s
    join plans p on p.id = s.plan_id
    where s.user_id = target_user_id
      and s.status in ('ACTIVE', 'TRIALING')
      and (s.current_period_end is null or s.current_period_end > now())
    order by s.created_at desc
    limit 1;

  if found then
    resolved_plan_key := active_sub.key;
    resolved_status := active_sub.source::text::entitlement_status;
    resolved_expires := active_sub.current_period_end;
    resolved_sub_id := active_sub.id;
  else
    select lg.id into active_grant
      from license_grants lg
      join licenses l on l.id = lg.license_id
      where lg.user_id = target_user_id
        and lg.revoked_at is null
        and l.status = 'ACTIVE'
        and (l.valid_until is null or l.valid_until >= current_date)
      limit 1;

    if found then
      resolved_plan_key := 'CAMPUS';
      resolved_status := 'INSTITUTIONAL';
    end if;
  end if;

  insert into entitlements (user_id, plan_key, status, source_subscription_id, expires_at, updated_at)
  values (target_user_id, resolved_plan_key, resolved_status, resolved_sub_id, resolved_expires, now())
  on conflict (user_id) do update
    set plan_key = excluded.plan_key, status = excluded.status,
        source_subscription_id = excluded.source_subscription_id,
        expires_at = excluded.expires_at, updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

create function trigger_recompute_entitlement() returns trigger as $$
begin
  perform recompute_entitlement(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create trigger subscriptions_recompute_entitlement
  after insert or update or delete on subscriptions
  for each row execute function trigger_recompute_entitlement();

create trigger license_grants_recompute_entitlement
  after insert or update or delete on license_grants
  for each row execute function trigger_recompute_entitlement();

create trigger user_roles_recompute_entitlement
  after insert or update or delete on user_roles
  for each row execute function trigger_recompute_entitlement();

create function get_active_plan_key(check_user_id uuid default auth.uid()) returns text as $$
  select coalesce(
    (select plan_key from entitlements where user_id = check_user_id),
    'FREE'
  );
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- RLS — billing writes are backend/staff-only (principle: critical admin ops
-- run server-side). Users can always read their own billing state.
-- ---------------------------------------------------------------------------
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table entitlements enable row level security;
alter table licenses enable row level security;
alter table license_grants enable row level security;
alter table coupons enable row level security;
alter table payments enable row level security;
alter table billing_events enable row level security;
alter table institution_contracts enable row level security;

create policy plans_select_all on plans for select using (true);
create policy plans_write_owner on plans for all using (is_owner()) with check (is_owner());

create policy subscriptions_select_own_or_staff on subscriptions
  for select using (user_id = auth.uid() or is_staff());
create policy subscriptions_write_staff on subscriptions
  for insert with check (is_owner() or has_role('SUPER_ADMIN') or auth.role() = 'service_role');
create policy subscriptions_update_staff on subscriptions
  for update using (is_owner() or has_role('SUPER_ADMIN') or auth.role() = 'service_role');

create policy entitlements_select_own_or_staff on entitlements
  for select using (user_id = auth.uid() or is_staff());
create policy entitlements_write_service_only on entitlements
  for all using (auth.role() = 'service_role' or is_owner())
  with check (auth.role() = 'service_role' or is_owner());

create policy licenses_select_institution_admin on licenses
  for select using (is_institution_admin(institution_id) or is_staff());
create policy licenses_write_staff on licenses
  for all using (is_owner() or has_role('SUPER_ADMIN'))
  with check (is_owner() or has_role('SUPER_ADMIN'));

create policy license_grants_select_own_or_admin on license_grants
  for select using (
    user_id = auth.uid()
    or is_staff()
    or exists (select 1 from licenses l where l.id = license_id and is_institution_admin(l.institution_id))
  );
create policy license_grants_write_staff on license_grants
  for all using (is_owner() or has_role('SUPER_ADMIN'))
  with check (is_owner() or has_role('SUPER_ADMIN'));

create policy coupons_staff_only on coupons
  for all using (is_owner() or has_role('SUPER_ADMIN'))
  with check (is_owner() or has_role('SUPER_ADMIN'));

create policy payments_select_own_or_staff on payments
  for select using (user_id = auth.uid() or is_staff());
create policy payments_write_service_only on payments
  for all using (auth.role() = 'service_role' or is_owner())
  with check (auth.role() = 'service_role' or is_owner());

create policy billing_events_staff_only on billing_events
  for all using (is_staff() or auth.role() = 'service_role')
  with check (is_staff() or auth.role() = 'service_role');

create policy institution_contracts_select_admin on institution_contracts
  for select using (is_institution_admin(institution_id) or is_staff());
create policy institution_contracts_write_staff on institution_contracts
  for all using (is_owner() or has_role('SUPER_ADMIN'))
  with check (is_owner() or has_role('SUPER_ADMIN'));

-- ============================================================
-- supabase/migrations/0011_platform_admin.sql
-- ============================================================
-- StudyFlow AI — Feature flags, audit trail, consent, usage analytics

create table feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- AI_TUTOR | AUDIO_CAPTURE | BLACKBOARD_SYNC | SMART_PLANNER | EXAM_MODE | NEW_DASHBOARD ...
  description text,
  enabled_globally boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger feature_flags_set_updated_at
  before update on feature_flags
  for each row execute function set_updated_at();

create type feature_flag_scope as enum ('global', 'institution', 'user', 'plan');

create table feature_flag_assignments (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid not null references feature_flags (id) on delete cascade,
  scope feature_flag_scope not null,
  scope_id text, -- institution_id / user_id / plan key, depending on scope; null for 'global'
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (flag_id, scope, scope_id)
);

create index feature_flag_assignments_flag_id_idx on feature_flag_assignments (flag_id);

create function is_feature_enabled(flag_key text, check_user_id uuid default auth.uid()) returns boolean as $$
declare
  flag record;
  user_institution_id uuid;
  user_plan_key text;
  has_user_override boolean;
  user_override_enabled boolean;
begin
  select * into flag from feature_flags where key = flag_key;
  if not found then
    return false;
  end if;

  select enabled into user_override_enabled from feature_flag_assignments
    where flag_id = flag.id and scope = 'user' and scope_id = check_user_id::text
    limit 1;
  if found then
    return user_override_enabled;
  end if;

  select institution_id into user_institution_id from student_enrollments
    where user_id = check_user_id and is_active = true limit 1;
  if user_institution_id is not null then
    select enabled into user_override_enabled from feature_flag_assignments
      where flag_id = flag.id and scope = 'institution' and scope_id = user_institution_id::text
      limit 1;
    if found then
      return user_override_enabled;
    end if;
  end if;

  select plan_key into user_plan_key from entitlements where user_id = check_user_id;
  if user_plan_key is not null then
    select enabled into user_override_enabled from feature_flag_assignments
      where flag_id = flag.id and scope = 'plan' and scope_id = user_plan_key
      limit 1;
    if found then
      return user_override_enabled;
    end if;
  end if;

  return flag.enabled_globally;
end;
$$ language plpgsql stable security definer set search_path = public;

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null, -- role_changed | license_granted | license_revoked | ...
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_actor_id_idx on audit_logs (actor_id);
create index audit_logs_action_idx on audit_logs (action);
create index audit_logs_created_at_idx on audit_logs (created_at);

create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index admin_actions_actor_id_idx on admin_actions (actor_id);

create type consent_type as enum ('AUDIO', 'AI_PROCESSING', 'DOCUMENT_PROCESSING', 'INTEGRATIONS', 'ANALYTICS');

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type consent_type not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);

create index consent_records_user_id_idx on consent_records (user_id);

create table usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index usage_events_user_id_idx on usage_events (user_id);
create index usage_events_event_name_idx on usage_events (event_name);

alter table feature_flags enable row level security;
alter table feature_flag_assignments enable row level security;
alter table audit_logs enable row level security;
alter table admin_actions enable row level security;
alter table consent_records enable row level security;
alter table usage_events enable row level security;

create policy feature_flags_select_authenticated on feature_flags
  for select using (auth.role() = 'authenticated');
create policy feature_flags_write_owner on feature_flags
  for all using (is_owner() or has_role('SUPER_ADMIN'))
  with check (is_owner() or has_role('SUPER_ADMIN'));

create policy feature_flag_assignments_select_authenticated on feature_flag_assignments
  for select using (auth.role() = 'authenticated');
create policy feature_flag_assignments_write_owner on feature_flag_assignments
  for all using (is_owner() or has_role('SUPER_ADMIN'))
  with check (is_owner() or has_role('SUPER_ADMIN'));

create policy audit_logs_select_staff on audit_logs
  for select using (is_staff());
create policy audit_logs_insert_authenticated on audit_logs
  for insert with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy admin_actions_select_staff on admin_actions
  for select using (is_staff());
create policy admin_actions_insert_staff on admin_actions
  for insert with check (is_staff() or auth.role() = 'service_role');

create policy consent_records_owner_only on consent_records
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy usage_events_insert_own on usage_events
  for insert with check (user_id = auth.uid() or auth.role() = 'service_role');
create policy usage_events_select_staff on usage_events
  for select using (is_staff());

-- ============================================================
-- supabase/seed/seed.sql
-- ============================================================
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


-- ============================================================
-- supabase/migrations/0012_storage_and_ai_content.sql
-- ============================================================
-- StudyFlow AI — Storage bucket for materials + AI-generated content
-- (summaries, mind maps, flashcards, questions, explanations)

insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do nothing;

-- Path convention: `${auth.uid()}/${filename}` — first folder segment is the
-- owner's user id, so these policies give strict per-user isolation, same
-- as every other table in this schema.
create policy "course_materials_storage_select_own"
  on storage.objects for select
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "course_materials_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "course_materials_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create type ai_content_type as enum ('summary', 'mindmap', 'flashcards', 'questions', 'explanation');

create table ai_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  material_id uuid references course_materials (id) on delete cascade,
  type ai_content_type not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index ai_content_material_id_idx on ai_content (material_id);
create index ai_content_user_id_idx on ai_content (user_id);

alter table ai_content enable row level security;

create policy ai_content_owner_only on ai_content
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- ============================================================
-- supabase/migrations/0013_calendar_theme.sql
-- ============================================================
-- StudyFlow AI — per-user calendar personalization (background/theme)

alter table profiles
  add column calendar_theme jsonb not null default '{"preset": "aurora"}';

-- ============================================================
-- supabase/migrations/0014_task_sort_order.sql
-- ============================================================
-- StudyFlow AI — manual task ordering (student-defined priority)
-- Null = task hasn't been manually placed yet; falls back to the priority
-- engine's score. Once the student drags a task, this becomes the order
-- used in "Arrastra para ordenar" mode.

alter table tasks
  add column sort_order integer;

create index tasks_sort_order_idx on tasks (user_id, sort_order);

-- ============================================================
-- supabase/migrations/0015_calendar_feed_token.sql
-- ============================================================
-- StudyFlow AI — personal calendar sync (subscribable .ics feed)
-- The token is a bearer credential for a read-only feed of one user's task
-- due dates — not their Supabase session. Regeneratable if it ever leaks.

alter table profiles
  add column calendar_feed_token text unique;

-- ============================================================
-- supabase/migrations/0016_task_collaboration.sql
-- ============================================================
-- StudyFlow AI — group work: invite classmates to a task, link a shared doc
--
-- We don't do OAuth/Graph API integration with Microsoft 365 here — no real
-- Azure app registration or institutional tenant consent exists for that
-- (see docs/duoc-integration/). Instead: a student generates a normal
-- "share" link from Word/Excel/PowerPoint Online themselves (their
-- institutional account already has that), pastes it on the task, and
-- StudyFlow just gives the group one obvious place to find it.

alter table tasks
  add column collaborative_doc_url text;

create type task_collaborator_status as enum ('PENDING', 'ACCEPTED');

create table task_collaborators (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  -- Set once the invited email matches an existing StudyFlow account.
  user_id uuid references profiles (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references profiles (id) on delete cascade,
  status task_collaborator_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (task_id, invited_email)
);

create index task_collaborators_task_id_idx on task_collaborators (task_id);
create index task_collaborators_user_id_idx on task_collaborators (user_id);

create function is_task_collaborator(check_task_id uuid) returns boolean as $$
  select exists (
    select 1 from task_collaborators
    where task_id = check_task_id and user_id = auth.uid() and status = 'ACCEPTED'
  );
$$ language sql stable security definer set search_path = public;

-- Auto-link a pending invite to a real account the moment that email signs
-- up (handle_new_auth_user already creates the profiles row before this).
create function link_pending_task_invites() returns trigger as $$
begin
  update task_collaborators
    set user_id = new.id, status = 'ACCEPTED'
    where lower(invited_email) = lower(new.email) and user_id is null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_profile_created_link_invites
  after insert on profiles
  for each row execute function link_pending_task_invites();

-- Collaborators can now see (and update progress on) tasks they were
-- invited into, on top of the existing owner-only policy.
create policy tasks_select_collaborator on tasks
  for select using (is_task_collaborator(id));

create policy tasks_update_collaborator on tasks
  for update using (is_task_collaborator(id));

alter table task_collaborators enable row level security;

create policy task_collaborators_select on task_collaborators
  for select using (
    user_id = auth.uid()
    or invited_by = auth.uid()
    or exists (select 1 from tasks t where t.id = task_id and t.user_id = auth.uid())
    or is_staff()
  );

create policy task_collaborators_insert on task_collaborators
  for insert with check (
    invited_by = auth.uid()
    and exists (select 1 from tasks t where t.id = task_id and t.user_id = auth.uid())
  );

create policy task_collaborators_delete on task_collaborators
  for delete using (
    exists (select 1 from tasks t where t.id = task_id and t.user_id = auth.uid())
    or user_id = auth.uid()
    or is_staff()
  );

-- ---------------------------------------------------------------------------
-- 0017_preferred_ai_provider.sql
-- ---------------------------------------------------------------------------
-- StudyFlow AI — let each student pick which external AI chat they prefer
-- (ChatGPT, Gemini, Claude, NotebookLM, etc.) so "Estudiar con IA" opens the
-- right one and remembers the choice across devices.

alter table profiles
  add column preferred_ai_provider text;

alter table profiles
  add constraint profiles_preferred_ai_provider_check
  check (preferred_ai_provider is null or preferred_ai_provider in ('chatgpt', 'gemini', 'claude', 'notebooklm'));

-- ---------------------------------------------------------------------------
-- 0018_study_profile.sql
-- ---------------------------------------------------------------------------
-- StudyFlow AI — Free study-planning stage: editable study profile
-- (master spec section 3). Every field here is a *declared preference*,
-- never an inferred diagnosis — see study_subject_confidence below for why
-- confidence is tracked separately from "comprehension reported after a
-- session" and "exercise result", instead of collapsing all three into one
-- number.

create table study_profiles (
  user_id uuid primary key references profiles (id) on delete cascade,
  academic_goal text,
  -- Subset of ('examples','steps','diagrams','exercises','questions','mixed').
  -- Validated at the app layer against @studyflow/shared EXPLANATION_METHODS;
  -- kept as a plain text[] here (Postgres enum[] alterations are painful,
  -- and this list is expected to evolve).
  explanation_methods text[] not null default '{}',
  session_duration_minutes int check (session_duration_minutes is null or session_duration_minutes between 5 and 240),
  schedule_preference text check (schedule_preference in ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'FLEXIBLE')),
  minutes_per_week int check (minutes_per_week is null or minutes_per_week between 0 and 10080),
  limitations_note text,
  free_notes text, -- "Cuéntanos cómo estudias" — free text, never auto-interpreted (section 3)
  onboarding_skipped boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger study_profiles_set_updated_at
  before update on study_profiles
  for each row execute function set_updated_at();

-- One row per (user, subject). `source` is forward-compatible: only
-- 'DECLARED' is ever written from the profile form today. 'REPORTED' and
-- 'EXERCISE_RESULT' evidence is derived at read time from study_sessions —
-- never stored here — so the UI can distinguish "the student told us" from
-- "we measured it" instead of quietly merging both into one value.
create table study_subject_confidence (
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  confidence smallint not null check (confidence between 1 and 5),
  source text not null default 'DECLARED' check (source in ('DECLARED', 'REPORTED', 'EXERCISE_RESULT')),
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

create index study_subject_confidence_user_id_idx on study_subject_confidence (user_id);

create trigger study_subject_confidence_set_updated_at
  before update on study_subject_confidence
  for each row execute function set_updated_at();

alter table study_profiles enable row level security;
alter table study_subject_confidence enable row level security;

create policy study_profiles_owner_only on study_profiles
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy study_subject_confidence_owner_only on study_subject_confidence
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- ---------------------------------------------------------------------------
-- 0019_study_availability.sql
-- ---------------------------------------------------------------------------
-- StudyFlow AI — Real availability (master spec section 4).
-- The planner must never treat an unlabeled empty hour as free time — only
-- an explicit STUDY_WINDOW block (plus an EXTRA_AVAILABLE exception) is
-- ever schedulable. CLASS/WORK/OTHER exist so the student's real commitments
-- are visible even though the planner only *needs* them to know what to
-- avoid overlapping if a STUDY_WINDOW is accidentally drawn over one.

create table availability_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('CLASS', 'WORK', 'OTHER', 'STUDY_WINDOW')),
  title text, -- optional generic label, e.g. "Trabajo" — never required
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Sun .. 6=Sat
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint availability_blocks_time_order check (end_time > start_time)
);

create index availability_blocks_user_id_idx on availability_blocks (user_id);

create table availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  exception_date date not null,
  kind text not null check (kind in ('UNAVAILABLE', 'EXTRA_AVAILABLE')),
  start_time time, -- null + UNAVAILABLE = blocks the whole day
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  constraint availability_exceptions_time_order check (
    (start_time is null and end_time is null) or (end_time > start_time)
  ),
  constraint availability_exceptions_extra_needs_times check (
    kind = 'UNAVAILABLE' or (start_time is not null and end_time is not null)
  )
);

create index availability_exceptions_user_id_idx on availability_exceptions (user_id);
create index availability_exceptions_date_idx on availability_exceptions (exception_date);

create table availability_settings (
  user_id uuid primary key references profiles (id) on delete cascade,
  timezone text not null default 'America/Santiago',
  max_daily_minutes int not null default 180 check (max_daily_minutes between 0 and 1440),
  break_minutes int not null default 10 check (break_minutes between 0 and 120),
  break_every_minutes int not null default 50 check (break_every_minutes between 5 and 480),
  updated_at timestamptz not null default now()
);

create trigger availability_settings_set_updated_at
  before update on availability_settings
  for each row execute function set_updated_at();

alter table availability_blocks enable row level security;
alter table availability_exceptions enable row level security;
alter table availability_settings enable row level security;

create policy availability_blocks_owner_only on availability_blocks
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy availability_exceptions_owner_only on availability_exceptions
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy availability_settings_owner_only on availability_settings
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- ---------------------------------------------------------------------------
-- 0020_study_plan_extensions.sql
-- ---------------------------------------------------------------------------
-- StudyFlow AI — Extend the existing study_plans / study_plan_items tables
-- for the free weekly planner (master spec section 5), instead of creating
-- parallel tables. These tables existed since 0006 but nothing ever wrote
-- to them yet (see docs/product/roadmap.md: "hoy solo existe el motor de
-- prioridad ... falta el generador de sesiones") — safe to add required
-- columns without a backfill.

alter table study_plans
  add column status text not null default 'ACTIVE' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  add column week_start date,
  add column generated_at timestamptz not null default now(),
  add column unassigned_minutes int not null default 0 check (unassigned_minutes >= 0);

-- One active plan per (user, week) — makes "regenerar" an idempotent
-- upsert (`on conflict (user_id, week_start) do update`) instead of ever
-- creating duplicate plans, even from a double click or two concurrent
-- requests (master spec section 10).
create unique index study_plans_user_week_idx on study_plans (user_id, week_start) where week_start is not null;

alter table study_plan_items
  add column subject_id uuid references subjects (id) on delete set null,
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column objective text,
  add column method text check (method in ('examples', 'steps', 'diagrams', 'exercises', 'questions', 'mixed')),
  add column expected_result text,
  add column priority_reason text,
  add column origin text not null default 'ENGINE' check (origin in ('ENGINE', 'GEMINI')),
  add column status text not null default 'PLANNED' check (status in ('PLANNED', 'COMPLETED', 'SKIPPED')),
  add column is_fixed boolean not null default false;

-- Belt-and-suspenders against duplicate inserts from a concurrent
-- regenerate: the same task can't occupy the same start instant twice in
-- one plan. Paired with `on conflict do nothing` in the regenerate action.
create unique index study_plan_items_dedupe_idx on study_plan_items (study_plan_id, task_id, starts_at);

create index study_plan_items_starts_at_idx on study_plan_items (starts_at);

-- `is_completed` predates this migration and stays for backward
-- compatibility with any existing reads — new code should prefer `status`.
comment on column study_plan_items.is_completed is 'Deprecated in favor of status = COMPLETED; kept for compatibility.';

-- ---------------------------------------------------------------------------
-- 0021_study_session_results.sql
-- ---------------------------------------------------------------------------
-- StudyFlow AI — Richer session completion capture (master spec section 8).
-- Extends the existing study_sessions table instead of creating a parallel
-- "results" table — a session and its result are the same event.
--
-- Deliberately separate from study_subject_confidence: time spent, comfort,
-- and difficulty are not the same thing as mastery. `comprehension_rating`
-- is self-reported and stored here as evidence for the adaptation engine;
-- it never silently overwrites study_subject_confidence.

alter table study_sessions
  add column study_plan_item_id uuid references study_plan_items (id) on delete set null,
  add column objective_status text check (objective_status in ('COMPLETED', 'PARTIAL', 'PENDING')),
  add column comprehension_rating smallint check (comprehension_rating between 1 and 5),
  add column difficulty_rating smallint check (difficulty_rating between 1 and 5),
  add column method_used text check (method_used in ('examples', 'steps', 'diagrams', 'exercises', 'questions', 'mixed')),
  add column check_result jsonb; -- {"correct": n, "total": n} — optional, only when a quick check happened

create index study_sessions_study_plan_item_id_idx on study_sessions (study_plan_item_id);
create index study_sessions_subject_id_idx on study_sessions (subject_id);

-- ---------------------------------------------------------------------------
-- 0022_gemini_proposals.sql
-- ---------------------------------------------------------------------------
-- StudyFlow AI — "Personalizar con mi Gemini" (master spec section 7).
-- StudyFlow never talks to Gemini programmatically: the student copies a
-- context StudyFlow built, pastes it into https://gemini.google.com/app
-- themselves, and pastes the answer back here. This table records both
-- halves of that round trip for audit and for the staleness check
-- ("rechaza propuestas obsoletas si las tareas ... cambiaron").

create table gemini_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  study_plan_id uuid references study_plans (id) on delete set null,
  schema_version int not null,
  -- sha256 of the exported context's task/constraint snapshot — an import
  -- is rejected as stale if the current snapshot's hash no longer matches.
  context_hash text not null,
  context_snapshot jsonb not null,
  -- The raw pasted-back text, kept for audit even if validation fails —
  -- never executed, never treated as anything but a JSON payload to parse.
  raw_response text,
  proposal jsonb,
  status text not null default 'PENDING_EXPORT' check (
    status in ('PENDING_EXPORT', 'PENDING_REVIEW', 'APPLIED', 'REJECTED', 'STALE', 'INVALID')
  ),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index gemini_proposals_user_id_idx on gemini_proposals (user_id);
create index gemini_proposals_status_idx on gemini_proposals (status);

alter table gemini_proposals enable row level security;

create policy gemini_proposals_owner_only on gemini_proposals
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- ---------------------------------------------------------------------------
-- 0023_study_observations.sql
-- ---------------------------------------------------------------------------
-- StudyFlow AI — Adaptation observations (master spec section 8). Proposed
-- by the rule-based engine in packages/academic-core, never applied
-- automatically — status only moves to ACCEPTED when the student confirms.

create table study_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  type text not null check (type in ('SHORTER_SESSIONS', 'LONGER_ESTIMATES', 'MORE_PRACTICE', 'DIFFERENT_METHOD')),
  evidence_count int not null check (evidence_count >= 3), -- must match MIN_EVIDENCE_SESSIONS
  rationale text not null,
  suggested_change jsonb not null,
  status text not null default 'PROPOSED' check (status in ('PROPOSED', 'ACCEPTED', 'DISMISSED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index study_observations_user_id_idx on study_observations (user_id);
create index study_observations_status_idx on study_observations (status);

-- Avoid re-proposing the exact same open observation every time the
-- adaptation check runs (e.g. after each completed session). subject_id is
-- nullable (SHORTER_SESSIONS is a global observation, not per-subject) —
-- Postgres treats NULL <> NULL in a plain unique index, so we coalesce to
-- a sentinel to actually dedupe the null case too.
create unique index study_observations_open_dedupe_idx
  on study_observations (user_id, (coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)), type)
  where status = 'PROPOSED';

alter table study_observations enable row level security;

create policy study_observations_owner_only on study_observations
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- ---------------------------------------------------------------------------
-- 0024_regenerate_study_plan_function.sql
-- ---------------------------------------------------------------------------
-- StudyFlow AI — Transactional, idempotent plan regeneration (master spec
-- section 10: "la regeneración debe ser idempotente, preservar historial y
-- evitar duplicados incluso con doble clic o solicitudes concurrentes").
--
-- A Postgres function body runs inside one transaction automatically, which
-- is the only way to get real atomicity here — supabase-js's REST API has
-- no multi-statement client transaction. `security invoker` (the default)
-- keeps this running as the calling user, so every existing RLS policy on
-- study_plans / study_plan_items still applies — this function grants no
-- extra privilege, it only makes the upsert+replace atomic.

create or replace function regenerate_study_plan(
  p_week_start date,
  p_title text,
  p_unassigned_minutes int,
  p_items jsonb -- array of {taskId, subjectId, startsAt, endsAt, objective, method, expectedResult, priorityReason, origin}
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_bad_task_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Defense in depth: RLS already scopes study_plan_items to plans the
  -- caller owns, but a task_id inside the payload could in principle name
  -- someone else's task — never trust it just because it parses as a uuid.
  select count(*) into v_bad_task_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  where (item->>'taskId') is not null
    and not exists (
      select 1 from tasks t where t.id = (item->>'taskId')::uuid and t.user_id = auth.uid()
    );

  if v_bad_task_count > 0 then
    raise exception 'one or more items reference a task the caller does not own';
  end if;

  insert into study_plans (user_id, title, starts_on, ends_on, week_start, status, generated_at, unassigned_minutes)
  values (auth.uid(), p_title, p_week_start, p_week_start + 6, p_week_start, 'ACTIVE', now(), coalesce(p_unassigned_minutes, 0))
  on conflict (user_id, week_start) do update
    set title = excluded.title,
        generated_at = excluded.generated_at,
        unassigned_minutes = excluded.unassigned_minutes,
        status = 'ACTIVE'
  returning id into v_plan_id;

  -- Replace only what the engine is allowed to touch: never-completed,
  -- never-pinned items. Completed sessions and explicitly fixed items are
  -- untouched, which is what "preservar historial" and "conservar ...
  -- bloques fijados" require.
  delete from study_plan_items
  where study_plan_id = v_plan_id
    and is_fixed = false
    and status <> 'COMPLETED';

  insert into study_plan_items (
    study_plan_id, task_id, subject_id, starts_at, ends_at, scheduled_date, scheduled_minutes,
    objective, method, expected_result, priority_reason, origin, status, is_fixed
  )
  select
    v_plan_id,
    (item->>'taskId')::uuid,
    (item->>'subjectId')::uuid,
    (item->>'startsAt')::timestamptz,
    (item->>'endsAt')::timestamptz,
    ((item->>'startsAt')::timestamptz)::date,
    round(extract(epoch from ((item->>'endsAt')::timestamptz - (item->>'startsAt')::timestamptz)) / 60)::int,
    item->>'objective',
    item->>'method',
    item->>'expectedResult',
    item->>'priorityReason',
    coalesce(item->>'origin', 'ENGINE'),
    'PLANNED',
    false
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  on conflict (study_plan_id, (coalesce(task_id, '00000000-0000-0000-0000-000000000000'::uuid)), starts_at) do nothing;

  return v_plan_id;
end;
$$;

comment on function regenerate_study_plan is
  'Atomically upserts the ACTIVE plan for (auth.uid(), p_week_start) and replaces its non-fixed, non-completed items. security invoker: relies entirely on existing RLS, grants no new privilege.';

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

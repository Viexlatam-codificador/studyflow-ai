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

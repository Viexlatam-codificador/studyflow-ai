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

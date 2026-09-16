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

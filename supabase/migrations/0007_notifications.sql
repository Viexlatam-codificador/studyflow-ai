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

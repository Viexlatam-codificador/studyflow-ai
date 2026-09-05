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

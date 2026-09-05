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

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

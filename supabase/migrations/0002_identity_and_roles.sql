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

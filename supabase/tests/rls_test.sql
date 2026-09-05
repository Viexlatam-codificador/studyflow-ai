-- StudyFlow AI — RLS / permission tests (pgTAP)
-- Run with the Supabase CLI: `supabase test db`
-- NOT YET EXECUTED in this environment (no local Postgres/Docker available)
-- — review carefully and run against a local Supabase project before relying
-- on it as a passing suite.

begin;
select plan(6);

-- Helper: run the rest of the transaction as a given user through Postgres
-- role + JWT claim, the same way PostgREST simulates `auth.uid()`.
create or replace function tests.authenticate_as(user_id uuid) returns void as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@example.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'student-b@example.com', now()),
  ('33333333-3333-3333-3333-333333333333', 'super-admin@example.com', now());

insert into user_roles (user_id, role) values
  ('33333333-3333-3333-3333-333333333333', 'SUPER_ADMIN');

insert into tasks (id, user_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Tarea privada de A');

-- ---------------------------------------------------------------------------
-- 1. User A can read their own task
-- ---------------------------------------------------------------------------
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from tasks where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'User A can read their own task'
);

-- ---------------------------------------------------------------------------
-- 2. User B CANNOT read User A's task (core isolation invariant)
-- ---------------------------------------------------------------------------
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from tasks where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'User B cannot read User A''s task'
);

-- ---------------------------------------------------------------------------
-- 3. User B cannot update User A's task either
-- ---------------------------------------------------------------------------
update tasks set title = 'hijacked' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select title from tasks where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Tarea privada de A',
  'User B cannot update User A''s task'
);

-- ---------------------------------------------------------------------------
-- 4. A regular student cannot self-grant an OWNER role
-- ---------------------------------------------------------------------------
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ insert into user_roles (user_id, role) values ('11111111-1111-1111-1111-111111111111', 'OWNER') $$,
  null,
  null,
  'A student cannot self-grant the OWNER role (RLS insert policy blocks it)'
);

-- ---------------------------------------------------------------------------
-- 5. Even SUPER_ADMIN cannot delete a granted OWNER role (trigger, not RLS)
-- ---------------------------------------------------------------------------
insert into user_roles (user_id, role) values ('33333333-3333-3333-3333-333333333333', 'OWNER');
-- re-authenticate as service_role-equivalent super admin acting through the app
select tests.authenticate_as('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ delete from user_roles where user_id = '33333333-3333-3333-3333-333333333333' and role = 'OWNER' $$,
  'P0001',
  'OWNER role cannot be revoked',
  'OWNER role is immutable even for the OWNER themself acting through the app role'
);

-- ---------------------------------------------------------------------------
-- 6. FREE user has no PRO entitlement by default
-- ---------------------------------------------------------------------------
select is(
  (select plan_key from entitlements where user_id = '11111111-1111-1111-1111-111111111111'),
  'FREE',
  'A freshly created user defaults to the FREE plan'
);

select * from finish();
rollback;

-- StudyFlow AI — group work: invite classmates to a task, link a shared doc
--
-- We don't do OAuth/Graph API integration with Microsoft 365 here — no real
-- Azure app registration or institutional tenant consent exists for that
-- (see docs/duoc-integration/). Instead: a student generates a normal
-- "share" link from Word/Excel/PowerPoint Online themselves (their
-- institutional account already has that), pastes it on the task, and
-- StudyFlow just gives the group one obvious place to find it.

alter table tasks
  add column collaborative_doc_url text;

create type task_collaborator_status as enum ('PENDING', 'ACCEPTED');

create table task_collaborators (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  -- Set once the invited email matches an existing StudyFlow account.
  user_id uuid references profiles (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references profiles (id) on delete cascade,
  status task_collaborator_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (task_id, invited_email)
);

create index task_collaborators_task_id_idx on task_collaborators (task_id);
create index task_collaborators_user_id_idx on task_collaborators (user_id);

create function is_task_collaborator(check_task_id uuid) returns boolean as $$
  select exists (
    select 1 from task_collaborators
    where task_id = check_task_id and user_id = auth.uid() and status = 'ACCEPTED'
  );
$$ language sql stable security definer set search_path = public;

-- Auto-link a pending invite to a real account the moment that email signs
-- up (handle_new_auth_user already creates the profiles row before this).
create function link_pending_task_invites() returns trigger as $$
begin
  update task_collaborators
    set user_id = new.id, status = 'ACCEPTED'
    where lower(invited_email) = lower(new.email) and user_id is null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_profile_created_link_invites
  after insert on profiles
  for each row execute function link_pending_task_invites();

-- Collaborators can now see (and update progress on) tasks they were
-- invited into, on top of the existing owner-only policy.
create policy tasks_select_collaborator on tasks
  for select using (is_task_collaborator(id));

create policy tasks_update_collaborator on tasks
  for update using (is_task_collaborator(id));

alter table task_collaborators enable row level security;

create policy task_collaborators_select on task_collaborators
  for select using (
    user_id = auth.uid()
    or invited_by = auth.uid()
    or exists (select 1 from tasks t where t.id = task_id and t.user_id = auth.uid())
    or is_staff()
  );

create policy task_collaborators_insert on task_collaborators
  for insert with check (
    invited_by = auth.uid()
    and exists (select 1 from tasks t where t.id = task_id and t.user_id = auth.uid())
  );

create policy task_collaborators_delete on task_collaborators
  for delete using (
    exists (select 1 from tasks t where t.id = task_id and t.user_id = auth.uid())
    or user_id = auth.uid()
    or is_staff()
  );

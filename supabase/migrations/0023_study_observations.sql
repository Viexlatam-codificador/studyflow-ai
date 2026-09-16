-- StudyFlow AI — Adaptation observations (master spec section 8). Proposed
-- by the rule-based engine in packages/academic-core, never applied
-- automatically — status only moves to ACCEPTED when the student confirms.

create table study_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  type text not null check (type in ('SHORTER_SESSIONS', 'LONGER_ESTIMATES', 'MORE_PRACTICE', 'DIFFERENT_METHOD')),
  evidence_count int not null check (evidence_count >= 3), -- must match MIN_EVIDENCE_SESSIONS
  rationale text not null,
  suggested_change jsonb not null,
  status text not null default 'PROPOSED' check (status in ('PROPOSED', 'ACCEPTED', 'DISMISSED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index study_observations_user_id_idx on study_observations (user_id);
create index study_observations_status_idx on study_observations (status);

-- Avoid re-proposing the exact same open observation every time the
-- adaptation check runs (e.g. after each completed session). subject_id is
-- nullable (SHORTER_SESSIONS is a global observation, not per-subject) —
-- Postgres treats NULL <> NULL in a plain unique index, so we coalesce to
-- a sentinel to actually dedupe the null case too.
create unique index study_observations_open_dedupe_idx
  on study_observations (user_id, (coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)), type)
  where status = 'PROPOSED';

alter table study_observations enable row level security;

create policy study_observations_owner_only on study_observations
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

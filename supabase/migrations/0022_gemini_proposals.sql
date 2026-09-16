-- StudyFlow AI — "Personalizar con mi Gemini" (master spec section 7).
-- StudyFlow never talks to Gemini programmatically: the student copies a
-- context StudyFlow built, pastes it into https://gemini.google.com/app
-- themselves, and pastes the answer back here. This table records both
-- halves of that round trip for audit and for the staleness check
-- ("rechaza propuestas obsoletas si las tareas ... cambiaron").

create table gemini_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  study_plan_id uuid references study_plans (id) on delete set null,
  schema_version int not null,
  -- sha256 of the exported context's task/constraint snapshot — an import
  -- is rejected as stale if the current snapshot's hash no longer matches.
  context_hash text not null,
  context_snapshot jsonb not null,
  -- The raw pasted-back text, kept for audit even if validation fails —
  -- never executed, never treated as anything but a JSON payload to parse.
  raw_response text,
  proposal jsonb,
  status text not null default 'PENDING_EXPORT' check (
    status in ('PENDING_EXPORT', 'PENDING_REVIEW', 'APPLIED', 'REJECTED', 'STALE', 'INVALID')
  ),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index gemini_proposals_user_id_idx on gemini_proposals (user_id);
create index gemini_proposals_status_idx on gemini_proposals (status);

alter table gemini_proposals enable row level security;

create policy gemini_proposals_owner_only on gemini_proposals
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

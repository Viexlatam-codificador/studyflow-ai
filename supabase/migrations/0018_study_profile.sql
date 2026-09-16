-- StudyFlow AI — Free study-planning stage: editable study profile
-- (master spec section 3). Every field here is a *declared preference*,
-- never an inferred diagnosis — see study_subject_confidence below for why
-- confidence is tracked separately from "comprehension reported after a
-- session" and "exercise result", instead of collapsing all three into one
-- number.

create table study_profiles (
  user_id uuid primary key references profiles (id) on delete cascade,
  academic_goal text,
  -- Subset of ('examples','steps','diagrams','exercises','questions','mixed').
  -- Validated at the app layer against @studyflow/shared EXPLANATION_METHODS;
  -- kept as a plain text[] here (Postgres enum[] alterations are painful,
  -- and this list is expected to evolve).
  explanation_methods text[] not null default '{}',
  session_duration_minutes int check (session_duration_minutes is null or session_duration_minutes between 5 and 240),
  schedule_preference text check (schedule_preference in ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'FLEXIBLE')),
  minutes_per_week int check (minutes_per_week is null or minutes_per_week between 0 and 10080),
  limitations_note text,
  free_notes text, -- "Cuéntanos cómo estudias" — free text, never auto-interpreted (section 3)
  onboarding_skipped boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger study_profiles_set_updated_at
  before update on study_profiles
  for each row execute function set_updated_at();

-- One row per (user, subject). `source` is forward-compatible: only
-- 'DECLARED' is ever written from the profile form today. 'REPORTED' and
-- 'EXERCISE_RESULT' evidence is derived at read time from study_sessions —
-- never stored here — so the UI can distinguish "the student told us" from
-- "we measured it" instead of quietly merging both into one value.
create table study_subject_confidence (
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  confidence smallint not null check (confidence between 1 and 5),
  source text not null default 'DECLARED' check (source in ('DECLARED', 'REPORTED', 'EXERCISE_RESULT')),
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

create index study_subject_confidence_user_id_idx on study_subject_confidence (user_id);

create trigger study_subject_confidence_set_updated_at
  before update on study_subject_confidence
  for each row execute function set_updated_at();

alter table study_profiles enable row level security;
alter table study_subject_confidence enable row level security;

create policy study_profiles_owner_only on study_profiles
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy study_subject_confidence_owner_only on study_subject_confidence
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

-- StudyFlow AI — Extend the existing study_plans / study_plan_items tables
-- for the free weekly planner (master spec section 5), instead of creating
-- parallel tables. These tables existed since 0006 but nothing ever wrote
-- to them yet (see docs/product/roadmap.md: "hoy solo existe el motor de
-- prioridad ... falta el generador de sesiones") — safe to add required
-- columns without a backfill.

alter table study_plans
  add column status text not null default 'ACTIVE' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  add column week_start date,
  add column generated_at timestamptz not null default now(),
  add column unassigned_minutes int not null default 0 check (unassigned_minutes >= 0);

-- One active plan per (user, week) — makes "regenerar" an idempotent
-- upsert (`on conflict (user_id, week_start) do update`) instead of ever
-- creating duplicate plans, even from a double click or two concurrent
-- requests (master spec section 10).
create unique index study_plans_user_week_idx on study_plans (user_id, week_start) where week_start is not null;

alter table study_plan_items
  add column subject_id uuid references subjects (id) on delete set null,
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column objective text,
  add column method text check (method in ('examples', 'steps', 'diagrams', 'exercises', 'questions', 'mixed')),
  add column expected_result text,
  add column priority_reason text,
  add column origin text not null default 'ENGINE' check (origin in ('ENGINE', 'GEMINI')),
  add column status text not null default 'PLANNED' check (status in ('PLANNED', 'COMPLETED', 'SKIPPED')),
  add column is_fixed boolean not null default false;

-- Belt-and-suspenders against duplicate inserts from a concurrent or
-- double-click regenerate: the same task (or, for task_id = null generic
-- review items, the sentinel below) can't occupy the same start instant
-- twice in one plan. Postgres treats NULL <> NULL in a plain unique index,
-- so task_id is coalesced to a sentinel to dedupe that case too. Paired
-- with `on conflict do nothing` in the regenerate action.
create unique index study_plan_items_dedupe_idx
  on study_plan_items (study_plan_id, (coalesce(task_id, '00000000-0000-0000-0000-000000000000'::uuid)), starts_at);

create index study_plan_items_starts_at_idx on study_plan_items (starts_at);

-- `is_completed` predates this migration and stays for backward
-- compatibility with any existing reads — new code should prefer `status`.
comment on column study_plan_items.is_completed is 'Deprecated in favor of status = COMPLETED; kept for compatibility.';

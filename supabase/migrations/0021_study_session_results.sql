-- StudyFlow AI — Richer session completion capture (master spec section 8).
-- Extends the existing study_sessions table instead of creating a parallel
-- "results" table — a session and its result are the same event.
--
-- Deliberately separate from study_subject_confidence: time spent, comfort,
-- and difficulty are not the same thing as mastery. `comprehension_rating`
-- is self-reported and stored here as evidence for the adaptation engine;
-- it never silently overwrites study_subject_confidence.

alter table study_sessions
  add column study_plan_item_id uuid references study_plan_items (id) on delete set null,
  add column objective_status text check (objective_status in ('COMPLETED', 'PARTIAL', 'PENDING')),
  add column comprehension_rating smallint check (comprehension_rating between 1 and 5),
  add column difficulty_rating smallint check (difficulty_rating between 1 and 5),
  add column method_used text check (method_used in ('examples', 'steps', 'diagrams', 'exercises', 'questions', 'mixed')),
  add column check_result jsonb; -- {"correct": n, "total": n} — optional, only when a quick check happened

create index study_sessions_study_plan_item_id_idx on study_sessions (study_plan_item_id);
create index study_sessions_subject_id_idx on study_sessions (subject_id);

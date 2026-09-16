-- Fix regenerate_study_plan(): ON CONFLICT (user_id, week_start) cannot
-- target a partial unique index (0020 created study_plans_user_week_idx
-- with `where week_start is not null`) unless the ON CONFLICT clause
-- repeats that exact predicate. Since week_start is always set by the
-- application (regenerate_study_plan always passes it), a plain
-- non-partial unique index is simpler and matches the conflict target
-- directly. NULLs (none exist in practice) remain distinct as usual.

drop index if exists study_plans_user_week_idx;

create unique index study_plans_user_week_idx on study_plans (user_id, week_start);

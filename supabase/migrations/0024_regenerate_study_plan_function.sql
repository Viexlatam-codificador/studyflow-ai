-- StudyFlow AI — Transactional, idempotent plan regeneration (master spec
-- section 10: "la regeneración debe ser idempotente, preservar historial y
-- evitar duplicados incluso con doble clic o solicitudes concurrentes").
--
-- A Postgres function body runs inside one transaction automatically, which
-- is the only way to get real atomicity here — supabase-js's REST API has
-- no multi-statement client transaction. `security invoker` (the default)
-- keeps this running as the calling user, so every existing RLS policy on
-- study_plans / study_plan_items still applies — this function grants no
-- extra privilege, it only makes the upsert+replace atomic.

create or replace function regenerate_study_plan(
  p_week_start date,
  p_title text,
  p_unassigned_minutes int,
  p_items jsonb -- array of {taskId, subjectId, startsAt, endsAt, objective, method, expectedResult, priorityReason, origin}
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_bad_task_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Defense in depth: RLS already scopes study_plan_items to plans the
  -- caller owns, but a task_id inside the payload could in principle name
  -- someone else's task — never trust it just because it parses as a uuid.
  select count(*) into v_bad_task_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  where (item->>'taskId') is not null
    and not exists (
      select 1 from tasks t where t.id = (item->>'taskId')::uuid and t.user_id = auth.uid()
    );

  if v_bad_task_count > 0 then
    raise exception 'one or more items reference a task the caller does not own';
  end if;

  insert into study_plans (user_id, title, starts_on, ends_on, week_start, status, generated_at, unassigned_minutes)
  values (auth.uid(), p_title, p_week_start, p_week_start + 6, p_week_start, 'ACTIVE', now(), coalesce(p_unassigned_minutes, 0))
  on conflict (user_id, week_start) do update
    set title = excluded.title,
        generated_at = excluded.generated_at,
        unassigned_minutes = excluded.unassigned_minutes,
        status = 'ACTIVE'
  returning id into v_plan_id;

  -- Replace only what the engine is allowed to touch: never-completed,
  -- never-pinned items. Completed sessions and explicitly fixed items are
  -- untouched, which is what "preservar historial" and "conservar ...
  -- bloques fijados" require.
  delete from study_plan_items
  where study_plan_id = v_plan_id
    and is_fixed = false
    and status <> 'COMPLETED';

  insert into study_plan_items (
    study_plan_id, task_id, subject_id, starts_at, ends_at, scheduled_date, scheduled_minutes,
    objective, method, expected_result, priority_reason, origin, status, is_fixed
  )
  select
    v_plan_id,
    (item->>'taskId')::uuid,
    (item->>'subjectId')::uuid,
    (item->>'startsAt')::timestamptz,
    (item->>'endsAt')::timestamptz,
    ((item->>'startsAt')::timestamptz)::date,
    round(extract(epoch from ((item->>'endsAt')::timestamptz - (item->>'startsAt')::timestamptz)) / 60)::int,
    item->>'objective',
    item->>'method',
    item->>'expectedResult',
    item->>'priorityReason',
    coalesce(item->>'origin', 'ENGINE'),
    'PLANNED',
    false
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  on conflict (study_plan_id, (coalesce(task_id, '00000000-0000-0000-0000-000000000000'::uuid)), starts_at) do nothing;

  return v_plan_id;
end;
$$;

comment on function regenerate_study_plan is
  'Atomically upserts the ACTIVE plan for (auth.uid(), p_week_start) and replaces its non-fixed, non-completed items. security invoker: relies entirely on existing RLS, grants no new privilege.';

-- StudyFlow AI — manual task ordering (student-defined priority)
-- Null = task hasn't been manually placed yet; falls back to the priority
-- engine's score. Once the student drags a task, this becomes the order
-- used in "Arrastra para ordenar" mode.

alter table tasks
  add column sort_order integer;

create index tasks_sort_order_idx on tasks (user_id, sort_order);

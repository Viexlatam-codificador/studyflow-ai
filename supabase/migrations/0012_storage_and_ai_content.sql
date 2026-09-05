-- StudyFlow AI — Storage bucket for materials + AI-generated content
-- (summaries, mind maps, flashcards, questions, explanations)

insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do nothing;

-- Path convention: `${auth.uid()}/${filename}` — first folder segment is the
-- owner's user id, so these policies give strict per-user isolation, same
-- as every other table in this schema.
create policy "course_materials_storage_select_own"
  on storage.objects for select
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "course_materials_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "course_materials_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create type ai_content_type as enum ('summary', 'mindmap', 'flashcards', 'questions', 'explanation');

create table ai_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  material_id uuid references course_materials (id) on delete cascade,
  type ai_content_type not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index ai_content_material_id_idx on ai_content (material_id);
create index ai_content_user_id_idx on ai_content (user_id);

alter table ai_content enable row level security;

create policy ai_content_owner_only on ai_content
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

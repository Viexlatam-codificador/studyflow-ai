-- StudyFlow AI — AI conversations, messages, usage/cost tracking

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  task_id uuid references tasks (id) on delete set null,
  title text,
  created_at timestamptz not null default now()
);

create index ai_conversations_user_id_idx on ai_conversations (user_id);

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb, -- RAG source citations shown to the user
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_id_idx on ai_messages (conversation_id);

-- Every AI call is logged here for cost tracking and the founder AI-usage dashboard.
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  provider text not null, -- openai | anthropic | google
  model text not null,
  feature text not null, -- e.g. INBOX_EXTRACTION, TUTOR_CHAT, PLANNER, EXAM_PREP
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_user_id_idx on ai_usage (user_id);
create index ai_usage_created_at_idx on ai_usage (created_at);

alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_usage enable row level security;

create policy ai_conversations_owner_only on ai_conversations
  for all using (user_id = auth.uid() or is_staff())
  with check (user_id = auth.uid() or is_staff());

create policy ai_messages_owner_only on ai_messages
  for all using (exists (select 1 from ai_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or is_staff())))
  with check (exists (select 1 from ai_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or is_staff())));

create policy ai_usage_owner_or_staff on ai_usage
  for select using (user_id = auth.uid() or is_staff());

create policy ai_usage_insert_service on ai_usage
  for insert with check (auth.role() = 'service_role' or user_id = auth.uid());

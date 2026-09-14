-- StudyFlow AI — let each student pick which external AI chat they prefer
-- (ChatGPT, Gemini, Claude, NotebookLM, etc.) so "Estudiar con IA" opens the
-- right one and remembers the choice across devices.

alter table profiles
  add column preferred_ai_provider text;

alter table profiles
  add constraint profiles_preferred_ai_provider_check
  check (preferred_ai_provider is null or preferred_ai_provider in ('chatgpt', 'gemini', 'claude', 'notebooklm'));

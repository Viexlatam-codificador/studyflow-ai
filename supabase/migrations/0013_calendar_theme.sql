-- StudyFlow AI — per-user calendar personalization (background/theme)

alter table profiles
  add column calendar_theme jsonb not null default '{"preset": "aurora"}';

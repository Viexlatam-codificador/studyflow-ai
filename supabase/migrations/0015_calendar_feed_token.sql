-- StudyFlow AI — personal calendar sync (subscribable .ics feed)
-- The token is a bearer credential for a read-only feed of one user's task
-- due dates — not their Supabase session. Regeneratable if it ever leaks.

alter table profiles
  add column calendar_feed_token text unique;

# Row Level Security policies

All RLS policies are defined inline in `supabase/migrations/*.sql`, next to the
tables they protect — that's the source of truth Postgres actually enforces.
This folder documents the policy *model* so it can be reviewed without reading
raw SQL.

## Core rules

- **Owner isolation**: tables like `tasks`, `study_sessions`, `inbox_items`,
  `course_materials` (private visibility), `ai_conversations` use
  `user_id = auth.uid()` — user A can never read user B's rows.
- **Staff bypass**: `is_staff()` (OWNER, SUPER_ADMIN, SUPPORT) can read
  everything for support purposes, but cannot bypass the OWNER-protection
  triggers on `user_roles` / `profiles.owner_locked`.
- **Institution scoping**: `is_institution_admin(institution_id)` gates
  writes to institution-level catalog data (subjects, classes, licenses,
  contracts) — an admin from Institution A cannot modify Institution B's data.
- **Billing writes are backend-only**: `subscriptions`, `entitlements`,
  `payments`, `licenses` reject client-side inserts/updates except from
  `service_role` or the OWNER — see `docs/security/`.
- **OWNER protection**: enforced by triggers (`protect_owner_role`,
  `protect_owner_lock`) in `0002_identity_and_roles.sql`, not just RLS —
  even a compromised SUPER_ADMIN session cannot demote or delete the OWNER.

See `supabase/migrations/0002_identity_and_roles.sql` through
`0011_platform_admin.sql` for the actual policies, and
`docs/security/rls-model.md` for the full table-by-table matrix.

# Database guide

Read [rules](../docs/contributing.md#4-database), [ERD](../docs/database/erd.md), [API contract](../docs/backend/api-contract.md), and [Supabase Cloud workflow](../docs/infrastructure/migration-workflow.md).

For SQL or RLS changes, load the [migration skill](skills/frameroom-supabase-migration/SKILL.md). Check current profile write behavior in the [API](../apps/api/src/routes/profile.ts) and [ordered migrations](../supabase/migrations).

Migrations define schema; ERD is a design. Add new migrations, never edit merged ones/dashboard schema. Use fake seed data, UUIDv7 application IDs, preserved Auth IDs, explicit constraints, and deny-by-default RLS.

Resolve feature decisions first. Verify positive/negative role access and transactional failure paths on a designated disposable Supabase Cloud test project. Generate types after schema verification.

If the designated Cloud test project is unavailable, record a blocked check and remaining command. Do not claim RLS passed or switch to another project.

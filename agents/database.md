# Database guide

Read [rules](../docs/contributing.md#4-database), [ERD](../docs/db/erd_v0.md), [contract](../docs/api/contract_v0.md), and [local workflow](../docs/db/local-development.md).

Migrations define schema; ERD is a design. Add new migrations, never edit merged ones/dashboard schema. Use fake seed data, UUIDv7 application IDs, preserved Auth IDs, explicit constraints, and deny-by-default RLS.

Resolve feature decisions first. Verify positive/negative role access and transactional failure paths. Reset only local data deliberately, never during normal startup. Generate types after replay.

If Docker is unavailable, record a blocked check and remaining command. Do not claim RLS passed or switch to hosted infrastructure.

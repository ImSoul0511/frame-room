---
name: frameroom-supabase-migration
description: Plan, implement, or review FrameRoom SQL migrations and their local replay, RLS access cases, transactions, and generated types. Use for a concrete database change; skip screen-only work, Auth UI questions without schema impact, and requests for hosted deployment.
---

# FrameRoom Supabase migration

## Inputs and scope

Read the task, approved behavior/schema decisions, [database guide](../../database.md), [local workflow](../../../docs/db/local-development.md), and affected [ERD](../../../docs/db/erd_v0.md)/[contract](../../../docs/api/contract_v0.md) sections. Inspect existing migrations, config, seed, generated types, and application callers.

For an unresolved design or read-only exercise, produce a conditional migration approach/access-test matrix and list prerequisite decisions; do not generate executable migration SQL or change the DB. A proposed ADR does not authorize implementation. Never turn a missing local prerequisite into a hosted database action.

## Workflow

1. Map the accepted contract to the smallest schema change. Identify constraints, indexes, ownership, write paths, and transaction boundaries. Separate unchanged identity/role rules from genuinely new behavior.
2. Use new migrations, never rewrite merged migrations or apply dashboard schema changes. Preserve Auth PK/FKs; use the existing UUIDv7 policy only for business IDs. Keep enum/deletion/timestamp rules aligned with the ERD rather than recreating unrelated business tables.
3. Design deny-by-default RLS for public tables. For each operation, enumerate allowed and denied anonymous, owner, other-user, relevant provider/manager, and manually provisioned admin cases. Test a forged user ID/metadata role as well as normal access. Privileged server paths need explicit authorization because service-role access bypasses RLS; a service-role-only test cannot prove RLS.
4. Identify atomic failure cases: uniqueness races, repeated requests, failed multi-step writes, and partial initialization. State which records must remain unchanged after rollback. For auth, explicitly compare Auth-user creation with application-profile creation; they are not automatically one transaction under an API-onboarding proposal.
5. Before any DB operation, identify its target and data effects. In an authorized local implementation, use the pinned project CLI, verify local Docker availability, replay deliberately with `corepack pnpm db:reset`, test access/failures, and run `corepack pnpm db:types` only after successful replay. Reset destroys local data; it is never implicit startup or a read-only validation step.
6. Use synthetic seed/test identities, avoid publishing credentials/status output, and record actual command results. If Docker is unavailable, mark replay/RLS/type generation blocked or not run; do not fabricate success or fall back to remote commands. Keep generated verification files out of Git.

## Output and completion

Produce a migration implementation or conditional plan with: source decisions, schema/contract mapping, role/action allow/deny matrix, transaction/race cases, replay/type-generation checks, and remaining prerequisites. Use the task's [verification template](../../templates/verification.md).

Complete when intended effects and failure invariants have evidence appropriate to the request. Planning can finish with explicit implementation blockers; migration/RLS execution cannot be called verified without actual local evidence. Obtain the database reviewers specified in the [contribution rules](../../../docs/contributing.md#4-database) before treating the design as accepted.

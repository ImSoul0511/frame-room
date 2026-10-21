# Local database development

## Prerequisites

Install workspace dependencies and start Docker Desktop's Linux engine. Run from the root; the CLI is project-pinned, with no global installation or hosted login needed.

```sh
corepack pnpm db:start
corepack pnpm db:status
corepack pnpm db:stop
```

First start downloads images. Ports: API 54321, PostgreSQL 54322, Studio 54323, local mail 54324. Do not publish status output containing credentials.

If the engine is stopped, startup reports a prerequisite failure. Web/API health still works. No business tables/buckets/RLS have been provisioned yet.

## Migration workflow

1. Resolve feature API/ERD questions with reviewers.
2. Create a migration: `corepack pnpm exec supabase migration new descriptive_name`.
3. Add SQL constraints/indexes/triggers and deny-by-default RLS. Never edit merged migrations/dashboard schema.
4. Seed synthetic data only.
5. Run `corepack pnpm db:reset` to replay **local** migrations/seed. This destroys local data and never runs during normal startup.
6. Run `corepack pnpm db:types`; UTF-8 types replace the previous file only after successful generation.
7. Verify roles/failure paths, obtain Ly/Khai review, and update contract/ERD/shared together.

Seed remains a placeholder until business migrations exist. Do not invent tables for foundation.

## RLS and media verification

For each new table/bucket, document allowed and denied reads/writes for anonymous, owner, unrelated user, assigned photographer, relevant manager, and admin as applicable.

- Public tables have RLS and explicit policies.
- Private brief/room/gallery/delivery files require current participation.
- Old assignees cannot retain access through history/subscriptions.
- Client metadata cannot grant roles/membership.
- Service-role operations explicitly authorize server-side.
- Storage paths/type/size/metadata match contract; API hiding cannot revoke public URLs.
- Failed transactions preserve booking/schedule/snapshot/event consistency.

Record evidence in the task artifact. Foundation does not claim unimplemented policies were tested.

## Hosted environments

Hosted linking, migration pushes, deployments, and CI/CD are deferred. Do not use remote commands to work around missing local Docker.

# Database MVP Cloud work and learning guide

Prepared on 2026-11-12 for Thao Ly, with Quynh Anh as mentor. Target review is
2026-11-15 at 23:59, Asia/Saigon, using the shared planning cutoff.

## 1. Role and outcome

Ly owns the revised ERD, versioned SQL, Supabase Cloud setup, environment handoff,
seed execution, generated types and day-to-day Cloud operations. Quynh Anh explains
design choices, reviews the search schema/data pipeline and pairs on access tests.
Khai reviews transactional booking rules and provides the required independent DB
review when Ly authors migrations. Nguyen integrates the API and indexing scripts.

By the checkpoint, a teammate should be able to connect local services to the shared
Cloud development project, use approved synthetic accounts, query a permitted indexed
catalog, and reproduce the applied schema from Git. Record the designated disposable
Cloud test project and the shared development project separately. Project creation,
migrations and key distribution are implementation tasks in this guide.

### Read and explain back

1. [Database overview](database-overview.md) and [table specifications](table-specifications.md).
2. [ERD](erd.md), [foreign keys](relationships.md), [constraints/indexes](constraints-and-indexes.md)
   and [functions/triggers](functions-and-triggers.md).
3. [RLS policies](rls-policies.md), [Storage configuration](storage-configuration.md),
   [Cloud setup](../infrastructure/supabase-cloud-setup.md) and
   [migration workflow](../infrastructure/migration-workflow.md).
4. [Contribution rules](../contributing.md), [database agent guide](../../agents/database.md),
   [Backend work plan](../backend/mvp-rebuild-work-plan.md) and
   [AI Search plan](../ai/ai-search-work-plan.md).

After reading, Ly explains what identifies a user, who can manage a studio, why a
booking needs one transaction, and which media is public. Quynh Anh uses a two-account
example to check the explanation before the first migration review.

## 2. Tasks, branches and mentor checkpoints

These are reserved local task IDs. Create `plans/tasks/<ID>.md` with acceptance and
verification evidence as each task starts. Branch from the latest reviewed `dev`.

| Task and branch                                 | Ly's deliverable                                                                                                      | Mentor/reviewer involvement                                                                                                                  | Target    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| DB-101 `chore/DB-101-erd-cloud-design`          | ERD corrections, dictionary, source-to-target migration map, Cloud project/region plan and open decisions             | Quynh Anh pairs for 45 minutes on keys/cardinality. Khai reviews identity/booking decisions.                                                 | 12 Nov    |
| DB-102 `feature/DB-102-cloud-core-schema`       | Cloud test/dev projects, Auth setup, identity/provider/catalog/project schema, baseline RLS, core environment handoff | Quynh Anh pairs for 30 minutes on first replay. Khai reviews constraints and grants.                                                         | 12-13 Nov |
| DB-103 `feature/DB-103-search-storage-schema`   | Buckets/policies, search vectors, compatible taxonomy seed, permitted corpus linkage and Cloud-generated types        | Quynh Anh pairs for 45 minutes on model/vector contract and direct Storage denial. Nguyen checks API/script compatibility. Khai reviews SQL. | 13 Nov    |
| DB-104 `feature/DB-104-booking-workflow-schema` | Booking/schedule/brief/room/proofing schema, atomic functions, queue/usage substrate and concurrency evidence         | Khai co-designs locks/RPC signatures. Quynh Anh pairs on two-session tests for 45 minutes.                                                   | 13-14 Nov |
| DB-105 `chore/DB-105-cloud-operations-handoff`  | Second fresh-project replay, verified promotion, type refresh, runbook/secret handoff and migration ledger            | Quynh Anh observes Ly performing the checklist independently. Khai reviews final DB PR.                                                      | 15 Nov    |

Each session ends with Ly recording the reason for one constraint/policy in her task
and one allowed/denied result. Quynh Anh reserves these short sessions around AIS-102/103
data work. Route broader backend implementation questions to Khai so mentoring stays
bounded during the search deadline.

## 3. Inventory the MVP scripts before rebuilding

Fetched reference SHA is `66f3779`. `dev` at `30e5373` has a migration placeholder and
an empty educational seed. Inspect every source below through `git show`.

| Exact reference path on the MVP branch                             | What to extract and verify                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/20261030000100_mvp_core.sql`                  | 34 public tables, 11 enums, extension setup, UUIDv7, keys/checks, authorization helpers, RLS, timestamps and initial indexes.                                |
| `supabase/migrations/20261030000200_mvp_workflows.sql`             | Booking transition/reschedule RPCs, schedule consistency, member-departure protection, queue/budget RPCs, buckets/policies, Realtime and initial nine tags.  |
| `supabase/migrations/20261030000300_mvp_providers.sql`             | Security-invoker `providers` union view.                                                                                                                     |
| `supabase/migrations/20261030000400_provider_genre_arrays.sql`     | Provider-view change preserving genre arrays.                                                                                                                |
| `supabase/migrations/20261030000500_assignment_serialization.sql`  | Assignment serialization fixes that must survive reconstruction.                                                                                             |
| `supabase/migrations/20261030000600_budget_settlement.sql`         | Spend reservation/settlement revisions.                                                                                                                      |
| `supabase/migrations/20261030000700_project_concept_selection.sql` | Selected artifact IDs and maximum 12 selections.                                                                                                             |
| `supabase/migrations/20261030000800_demo_daily_ai_limit.sql`       | Demo daily cap semantics. Decide the new configured cap with Nguyen and Quynh Anh.                                                                           |
| `supabase/seed.sql`, `supabase/config.toml`                        | Seed/config intent and local Auth/Storage settings requiring Cloud translation.                                                                              |
| `apps/api/src/demo-seed.ts`                                        | Synthetic Auth/profile/provider/service/resource/media setup and ownership mapping. Hardcoded local guard, demo password and image sources require redesign. |
| `apps/api/src/verify-database.ts`, `tests/e2e/mvp.spec.ts`         | Allowed/denied and workflow scenarios to adapt to designated Cloud test data.                                                                                |
| `scripts/db-types.mjs`, `scripts/local-env.mjs`                    | Local-only type/env assumptions to replace with explicit Cloud project targeting.                                                                            |
| `apps/api/src/index-portfolios.ts`, `evaluate-search.ts`           | Local-only indexing/evaluation entry points coordinated with AIS-104/105.                                                                                    |

```powershell
git show feature/MVP-001-ai-focused-workflow:supabase/migrations/20261030000100_mvp_core.sql
git show feature/MVP-001-ai-focused-workflow:supabase/migrations/20261030000500_assignment_serialization.sql
git show feature/MVP-001-ai-focused-workflow:apps/api/src/demo-seed.ts
```

Create a source-to-target checklist for all eight migrations. Mark each semantic change
as retained, revised with reason, or scheduled with a task. Fresh target migrations
may be split into smaller reviewable files, provided replay creates the approved final
state. Order them as extensions/types/helpers, identity/provider/catalog, project/search,
booking/room/proofing, functions/triggers, policies/buckets/publication/views and seeds.
Functions that reference tables come after those tables. Privileges are part of each
object's migration. Add later corrections with a new migration ID after merge.

## 4. Improve the ERD with a designer's checklist

### Cardinality and identity

The current Mermaid diagram uses several one-to-many edges where SQL imposes uniqueness.
Mark PK, FK and UK fields and use the actual optionality below.

| Relationship                   | Expected drawing and reason                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth user to profile           | One Auth identity has zero or one profile while onboarding is incomplete. `profiles.id` is both PK and Auth FK.                                    |
| Profile to photographer        | Zero or one photographer because `photographers.user_id` is unique. Distinguish photographer business `id` from its Auth `user_id`.                |
| Profile to system-admin role   | Zero or one `user_roles` row under the current `user_id` PK. Public signup does not grant this role.                                               |
| Studio to photographer         | Many-to-many through `studio_members`, composite PK `(studio_id,user_id)`. Membership points to `photographers.user_id`.                           |
| Service/portfolio to owner     | Exactly one photographer or studio, checked with `owner_type` and exclusive non-null FKs. Two nullable arrows alone do not express this invariant. |
| Project to booking             | Zero or one booking because `bookings.project_id` is unique. Booking records preserve their service/price snapshot.                                |
| Booking to room/gallery/review | Zero or one of each where the SQL key is unique. Add state-based creation/read rules as notes.                                                     |
| Image to tag                   | Many-to-many through `image_tags`, PK `(portfolio_image_id,tag_id)`. Record `manual`/`ai` source and confidence.                                   |
| Image to active embedding      | Zero or one under MVP `image_embeddings.image_id` PK. A model-version history design requires an explicit key change.                              |
| Gallery to selection           | Per-round selection key `(gallery_id,image_id,round)`. The selected image must belong to that gallery.                                             |

Use two diagrams for readability, covering identity/catalog/search and
booking/collaboration/AI operations. Keep a complete relationship map and a dictionary
with type, nullability, default, uniqueness, deletion rule and business meaning. Explicitly
label managed `auth.users` and `storage.objects`. Document application-only links such
as Storage paths and polymorphic report targets that lack declared FKs.

### Design choices and reasons

- Keep normalized relation tables for memberships, tags, resources and selections. Their
  keys stop duplicates and make permission checks traceable.
- Preserve Auth UUIDs. Use the migration's UUIDv7 function for new business IDs, supporting
  the repository's ordered-ID convention. Composite joins and Auth-linked PKs retain
  their documented exceptions.
- Use `timestamptz` for instants and store UTC. UI rendering uses the viewer's timezone.
  Use half-open booking ranges `[start,end)` so adjacent sessions can meet at one instant.
- Store VND integer amounts for service/booking prices and numeric USD for AI usage.
  Snapshot sold service/add-ons so later catalog edits preserve booking history.
- Enforce positive intervals, unique username, one booking per project and valid owner
  combinations in SQL. These constraints also protect against concurrent API calls.
- Put schedule conflict checks in `tstzrange` GiST exclusions with `btree_gist`.
  API prechecks improve error messages, while the constraint handles the race at commit.
- Use an integer version for optimistic booking/project changes. A stale mutation returns
  a conflict and lets the client refetch current state.
- Retain durable booking history. Soft-delete catalog objects and reviews according to
  existing rules, and defer portfolio-object cleanup for 30 days.
- Keep vectors separate from image rows. For the initial milestone, retain one active
  768-d vector per image and make its model identity include the agreed pipeline fingerprint.
  A model switch reindexes the complete corpus before switching active search. Quynh Anh
  and Nguyen confirm this with Ly during AIS-101. Model history can use a future composite key.
- At 100-200 images, use exact cosine ranking first. Measure SQL latency before adding
  HNSW and its cosine operator class. Retrieval must still apply publication/provider/model
  filters and return sufficient filtered candidates.
- Preserve the existing tag kinds `tone`, `setting`, `mood` in the first schema. Extended
  lighting/composition/style facets live in the versioned dataset taxonomy until a reviewed
  contract and enum migration adds them. This keeps `GET /tags` compatible with the frontend.

## 5. Set up Supabase Cloud step by step

### Project and Auth setup

1. Record the team organization, project name/ref, Postgres version, selected region and
   access owners. Pick a region near the team that the selected account supports.
2. Provision a disposable Cloud test project and shared Cloud development project.
   Keep test identities/media identifiable by a run ID. Record any project-quota blocker
   and coordinate the designated test target with the team.
3. Record Auth Site URL `http://localhost:5173` and the exact redirect paths the transferred
   `apps/web/src/lib/auth.tsx` uses. Configure email/password, email confirmation and
   callback allowlist to match BE-101. Test verification and password recovery.
4. Check availability and schema placement of `pgcrypto`, `btree_gist`, `vector` and `pgmq`.
   Prefer extension creation through the reviewed migrations. Record any hosted limitation.
5. Copy the database connection string from the project's Connect panel. Use direct
   connection where the team network supports it, or the session pooler for IPv4-only
   development. Match database user, TLS and driver options with Khai. A connectivity
   check precedes migration/type generation. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)

Decide explicit profile initialization with Khai and Khoa. The existing
[proposed ADR](../adr/0003-auth-profile-initialization.md) and reference `POST /v1/me`
need reconciliation. Keep Auth signup and profile creation as their actual transaction
boundaries when using API onboarding. An incomplete Auth account can resume onboarding.

### Apply reviewed migrations

Commands below target the repo-pinned Supabase CLI 2.121.0. Their help flags were
checked during planning. Current online documentation also covers newer CLI syntax,
so verify the installed version before using its examples. `--project-ref` for push/list
and `--project-id` for type generation are supported by the pinned version.
[Supabase CLI reference](https://supabase.com/docs/reference/cli/)

During the implementation task, authenticate with Ly's authorized account, set
`SUPABASE_PROJECT_REF` to the designated test ref and confirm the displayed project
in the Dashboard. Keep passwords/tokens in the local session or CLI prompt. Inspect
`supabase/config.toml` for referenced secrets before using push.

```powershell
pnpm --version
pnpm exec supabase --version
pnpm exec supabase login
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_PROJECT_REF)) {
  throw 'Set the designated Cloud test project reference first.'
}
pnpm exec supabase migration list --project-ref $env:SUPABASE_PROJECT_REF
if ($LASTEXITCODE -ne 0) { throw 'Migration history check failed.' }
pnpm exec supabase db push --project-ref $env:SUPABASE_PROJECT_REF --skip-vault --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Migration dry run failed.' }
```

Review the pending IDs against the task's source-to-target map. After confirming the
same project ref and reviewed SQL, apply the migration set and record its history.

```powershell
pnpm exec supabase db push --project-ref $env:SUPABASE_PROJECT_REF --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'Stop and inspect the failed migration.' }
pnpm exec supabase migration list --project-ref $env:SUPABASE_PROJECT_REF
if ($LASTEXITCODE -ne 0) { throw 'Post-apply history check failed.' }
```

Do this first on the disposable project. After access/concurrency checks pass, promote
the same reviewed migration set to the explicitly selected shared dev ref. Apply fake
seed data through the reviewed Cloud-aware seed entry point. Migrations and seeds have
separate effects, so inspect each result independently. Historical `db:start`, `db:reset`,
`db:types` and `demo:configure` commands target local Supabase and need the Cloud replacements
assigned below.

### Storage, Realtime and generated types

Use migrations to create buckets and `storage.objects` policies from the
[Storage specification](storage-configuration.md). Public buckets are `avatars`,
`profile-covers`, `portfolio-images`, capped at 2 MiB WebP. Private 2 MiB WebP buckets
are `gallery-previews`, `brief-references`, `room-files`, `search-uploads`.
`ai-artifacts` permits 5 MiB WebP. `deliveries` permits 20 MiB JPEG/PNG/WebP.

API image normalization and object ownership must agree with these caps. Test the
five-minute signed URL expiry, wrong-owner reads and path registration. An existing
public URL and an already issued signed URL have their documented access lifetimes.
Add room messages/decisions/milestones and AI jobs to the intended Realtime publication,
then test an allowed subscription and a removed-member subscription with real JWTs.

After schema verification, generate into a temporary file and replace the tracked
type artifact only after successful nonempty output. This PowerShell example preserves
UTF-8 without a BOM and LF. Inspect the diff before committing.

```powershell
$generatedTypes = & pnpm exec supabase gen types typescript --project-id $env:SUPABASE_PROJECT_REF --schema public
if ($LASTEXITCODE -ne 0 -or -not $generatedTypes) {
  throw 'Cloud type generation failed. Keep the existing types.'
}
$typesPath = Join-Path (Get-Location) 'packages/shared/src/db.types.ts'
$typesTemporaryPath = "$typesPath.tmp"
$typesText = ($generatedTypes -join "`n") + "`n"
[System.IO.File]::WriteAllText($typesTemporaryPath, $typesText, [System.Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $typesTemporaryPath -Destination $typesPath -Force
pnpm --filter @frameroom/shared build
```

DB-103 updates `scripts/db-types.mjs` to accept an explicit Cloud target with the same
failure-safe write behavior. Ly owns the generated source. Nguyen reviews API compile
compatibility. Generated types follow the applied schema's selected columns/enums.

## 6. Supply the team's environment files

Ly maintains an example-safe `.env.example` and a private handoff checklist. Send each
person the required values through the team's private secret-sharing channel. Record
recipient, project ref, key purpose and handoff date without copying secret values
into task artifacts. The runtime loaders must read these names during the corresponding
Backend/AI tasks. The foundation currently validates only basic API server settings.

| Recipient                 | Variables to supply                                                                                                                   | Why                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Khoa, frontend            | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`                                                                         | Browser can use public URL/key and the user's JWT.                                           |
| Khai and Nguyen, backend  | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, server credential agreed with adapter, `DATABASE_URL`, `WEB_ORIGIN`, `HOST`, `PORT`, `LOG_LEVEL` | API verifies identity, performs authorized DB/Storage work and matches CORS.                 |
| Nguyen, API-to-AI adapter | `AI_SERVICE_URL`, proposed `AI_SERVICE_TOKEN`, agreed timeout/model/pipeline identifiers                                              | Private service authentication and compatible indexing/search.                               |
| Quynh Anh, AI/data        | Model configuration and any chosen provider key, corpus paths and permitted service access                                            | Descriptor/embedding/evaluation work. Backend runs Cloud writes through the agreed pipeline. |
| Ly, database operations   | CLI account/access token, project ref and migration connection credentials                                                            | Schema promotion and operation under a designated account.                                   |

The reference expects a JWT-based `SUPABASE_SERVICE_ROLE_KEY`. Modern Supabase also
offers publishable and secret keys, with different token semantics. Choose the supported
key family with BE-101 and test the SDK flow before changing environment names. Privileged
keys bypass RLS and stay in server-side configuration. Each frontend developer receives
the public values. [Supabase API key guide](https://supabase.com/docs/guides/getting-started/api-keys)

Ly checks `.gitignore`, replaces local URLs in `.env.example` through her reviewed
task, and asks each recipient to confirm a health/Auth/profile smoke test. Nguyen owns
provider keys and spend configuration. API and browser public URLs must refer to the
same Cloud project. Keep real `.env` files untracked.

## 7. Seeds, access tests and failure tests

DB-103 coordinates a Cloud-aware synthetic seed with Nguyen's BE-103/AIS-104 work.
Make the seed repeatable by a stable seed key and explicit project ref. Configure demo
credentials privately, namespace test accounts, and write only permitted corpus items.
Reference scripts hardcode localhost and use Unsplash images, so both target selection
and source rights require review. Track Auth accounts, DB rows and Storage objects as
separate retry/cleanup steps with a seed-run manifest.

| Scenario            | Allowed result                                                                       | Denied or failure result                                                                    |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Anonymous catalog   | Published visible provider/image projection                                          | Draft, hidden/deleted content and private tables/objects are absent.                        |
| Own profile/project | Verified owner can read and write through API                                        | Another user's ID and forged signup admin/manager metadata grant no access.                 |
| Studio control      | Current manager can manage team/catalog/resources                                    | Ordinary/removed member cannot manage. Last manager and assigned departure fail atomically. |
| Booking/room        | Client, assigned photographer and current manager receive their permitted projection | Unrelated and removed/unassigned users lose new private reads/subscriptions.                |
| Gallery/delivery    | Eligible participant reads at permitted state, client selects, provider delivers     | Wrong gallery image, stale round, premature delivery and second lifetime review fail.       |
| Search/index        | Compatible vectors from visible published permitted images are used                  | Cross-user upload, hidden image and incompatible pipeline are excluded or rejected.         |
| Admin               | Manually provisioned admin can moderate reports                                      | Admin gets no implicit blanket private-room read.                                           |
| Privileged RPC      | Authorized server executes the scoped transaction                                    | `anon` and `authenticated` cannot directly execute booking/queue/budget privileged RPCs.    |

Run these through API and directly through anon/authenticated Supabase clients. In
addition, use two concurrent DB sessions/API requests for normalized username collision,
same-user onboarding retry, overlapping photographer/resource reservations, member
departure versus assignment, stale booking versions and AI spend reservation. Capture
pre/post row counts and verify failed transactions leave a consistent state.

Enable RLS on every public table. Review broad `profiles_read` against the actual
columns, and expose only the intended public projection. Review `SECURITY DEFINER`
helpers with fixed `search_path`, explicit grants and recursion-safe policies. A test
using only service-role credentials cannot establish authenticated-user isolation.

## 8. Operating and recovering the Cloud service

- At the start of a migration session, confirm project ref, Git SHA, pending migration
  IDs and known backups. Keep a ledger with SHA, IDs/checksums, actor, date and outcome.
- Inspect Dashboard database/Auth/Storage logs for the scoped failing request. Record
  request ID and sanitized error. Check connection, grants, RLS and SQL separately.
- For a failed migration, inspect the actual history and object state before retrying.
  Diagnose with Quynh Anh/Khai. Use a reviewed repair or forward migration for shared
  state and record the outcome. Replay from scratch on the designated fresh test project.
- For seed failure, resume from the seed-run manifest and its stable IDs. Clean only
  that run's accounts/objects/rows after checking their references.
- Before an incompatible change, verify the available Cloud backup/export mechanism
  and recovery steps for the team's plan. Storage objects need their own inventory/copy.
  SQL history in Git records schema evolution.
- Manage pause/resume, plan/quota and project membership from the authorized Dashboard.
  Coordinate shared-service interruption with the team and record a verification check
  after resume. Use bounded retention/cleanup jobs once their policy is agreed.

## 9. Commit and final handoff

Use the branch table and the common [Backend Git guide](../backend/mvp-rebuild-work-plan.md).
Examples pass the repository commit format.

```text
docs(db): clarify erd ownership and keys [DB-101]
feat(db): add cloud catalog constraints [DB-102]
feat(db): add compatible search vectors [DB-103]
fix(db): serialize booking assignment [DB-104]
```

Markdown formatting runs in pre-commit. SQL requires explicit replay/RLS/concurrency
checks. Run `pnpm docs:check`, `pnpm format:check` and applicable `pnpm check` after
generated/shared changes. Record Cloud evidence separately from root workspace checks.

- [ ] ERD has accurate cardinality, keys, optionality and deletion/ownership notes.
- [ ] Every MVP migration's semantic change is accounted for in the target checklist.
- [ ] Reviewed migrations replay on a fresh designated Cloud project and promote to dev.
- [ ] Required Auth, Storage, grants, RLS, Realtime and vector contract are verified.
- [ ] Two-user denial and transactional race scenarios have evidence.
- [ ] Environment handoff is confirmed by every recipient and generated types build.
- [ ] Operations ledger includes known failures, recovery steps and next task owners.
- [ ] Quynh Anh completes the mentor walkthrough and Khai provides DB review approval.

Planning evidence is tracked in [PLAN-001](../../plans/tasks/PLAN-001.md).

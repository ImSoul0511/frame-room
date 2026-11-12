# Backend MVP reconstruction work plan

Prepared on 2026-11-12. Target checkpoint is 2026-11-15 at 23:59, Asia/Saigon.
That end-of-day cutoff is a planning assumption. Owners confirm availability on day one.

## 1. Context and reading order

After fetching origin, local and remote `main`/`dev` point to `30e5373`. The MVP
reference is `feature/MVP-001-ai-focused-workflow` at `66f3779`. Current Fastify
implements `GET /health`. Python also has only health. Older documents containing
`a799dea` describe an earlier snapshot. Recheck SHAs when implementation starts.

Read the following in order.

1. [Agent entrypoint](../../agents/README.md), [contribution rules](../contributing.md)
   and [Backend guide](../../agents/backend.md).
2. [Frontend handoff](../transition/frontend-shared-push-manifest.md) and
   [Frontend requirements](../frontend/api-requirements.md). Dang Khoa owns that push.
3. [API contract](api-contract.md), [endpoint inventory](endpoint-inventory.md),
   [service responsibilities](service-specifications.md) and
   [authorization matrix](authorization-matrix.md).
4. [Database guide](../database/mvp-cloud-work-guide.md) and
   [AI Search guide](../ai/ai-search-work-plan.md).

Inspect reference files without checking out MVP code into the target branch.

```powershell
git show feature/MVP-001-ai-focused-workflow:apps/api/src/routes/business.ts
git show feature/MVP-001-ai-focused-workflow:packages/shared/src/business.ts
git show feature/MVP-001-ai-focused-workflow:apps/api/src/services/bookings.ts
git show feature/MVP-001-ai-focused-workflow:apps/api/src/verify-database.ts
git show feature/MVP-001-ai-focused-workflow:tests/e2e/mvp.spec.ts
```

Trace each rebuilt slice through its service, repository, SQL and browser caller.
The reference `business.ts` combines many routes. Split new modules by the tasks below.

## 2. Deliverable and ownership

The 15 November framework target includes verified Cloud Auth/profile recovery, a real
provider/catalog/upload slice, owned projects, transactional booking/brief operations,
and text AI Search over a permitted indexed corpus. The remaining endpoint groups have
assigned owners and contracts in this plan. Full completion of every group is a stretch
for this four-day window. Assess progress on 14 November before adding further work.

Search is the first product integration demo. Booking concurrency and authorization
remain acceptance requirements whenever their endpoints are enabled. Each unfinished
feature has a recorded task state and an explicit UI capability/loading/error state.

| Task   | Owner       | Reviewer                           | Branch                              | Target and dependencies                                                                                                                                                                                         |
| ------ | ----------- | ---------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-101 | Khai        | Khoi Nguyen, Khoa for wire shapes  | `feature/BE-101-api-contract-auth`  | 12 Nov. Freeze shared/OpenAPI shapes, errors, Auth/profile and route registration. Needs Khoa's shared handoff and DB-101 identity decision.                                                                    |
| BE-102 | Khai        | Khoi Nguyen, Ly for DB interaction | `feature/BE-102-provider-catalog`   | 13 Nov. Providers, studios/team, resources, services/add-ons, portfolios/tags. Start public discovery and minimum seed-compatible catalog first. Needs DB-102.                                                  |
| BE-103 | Khoi Nguyen | Khai, Ly for Storage               | `feature/BE-103-media-projects`     | 12-13 Nov. Upload boundary and project CRUD, references/artifacts projections. Needs DB-102/103.                                                                                                                |
| BE-104 | Khoi Nguyen | Khai and Quynh Anh                 | `feature/BE-104-ai-search-adapter`  | 13-14 Nov. Search route, candidate filtering, DB ranking, index adapter and usage read. Needs BE-101/102, AIS-101/102/104, DB-103.                                                                              |
| BE-105 | Khai        | Khoi Nguyen, Ly                    | `feature/BE-105-booking-scheduling` | 13-14 Nov. Booking, schedule, brief approval and workspace. Needs BE-102/103, DB-104 RPCs.                                                                                                                      |
| BE-106 | Khai        | Khoi Nguyen, Khoa for workflow     | `feature/BE-106-room-delivery`      | 14-15 Nov stretch after core. Room, proofing, deliveries, reviews and timeline. Needs BE-105, DB-104.                                                                                                           |
| BE-107 | Khoi Nguyen | Khai and Quynh Anh                 | `feature/BE-107-ai-jobs-actions`    | Framework after search passes. Jobs, access/budget ledger, proposal confirmation and chat transport. Generation/edit/cull execution follows search. Needs queue/usage schema and accepted internal AI contract. |
| BE-108 | Khai        | Khoi Nguyen and Quynh Anh          | `feature/BE-108-moderation`         | Follow-up after core gates. Reports/admin moderation and aggregate dashboard completion. Needs derived admin role and catalog hiding.                                                                           |

Khai owns auth/access helpers, SQL transaction adapter and route registration composition.
Khoi Nguyen owns the HTTP AI client and media service. Each registers its module through
a small agreed plugin interface. Khoa owns browser-consumed shared exports during the
frontend handoff. Subsequent shared changes have a named owner in the task and Khoa's
compatibility review. Ly owns migrations and generated DB types. Coordinate lockfile
updates through the current dependency-changing PR.

Khoi Nguyen's order is BE-103, AIS-101, BE-104/AIS-104, then BE-107. Quynh Anh's
DB mentoring checkpoints are reserved in the Database guide. Avoid assigning both
people a full day of unrelated work during search integration.

## 3. Complete endpoint allocation

Each row refers to the field-level Zod schema and status in the
[inventory](endpoint-inventory.md). P0 is the framework target. P1 is the next
complete workflow slice. P2 follows search acceptance. These priorities supersede
the older search-P1 order in [implementation backlog](implementation-backlog.md)
for this milestone.

| Task   | Priority | Endpoints                                                                                                                        |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| BE-101 | P0       | `GET /health`, `GET /v1/config`, `GET /v1/openapi.json`                                                                          |
| BE-101 | P0       | `GET /v1/me`, `POST /v1/me`, `PATCH /v1/me`                                                                                      |
| BE-101 | P0       | `GET /v1/photographers/me`, `POST /v1/photographers/me`, `PATCH /v1/photographers/me`                                            |
| BE-102 | P0       | `GET /v1/explore`, `GET /v1/photographers`, `GET /v1/photographers/:id`                                                          |
| BE-102 | P0       | `GET /v1/studios`, `GET /v1/studios/:id`, `GET /v1/me/studios`                                                                   |
| BE-102 | P0       | `POST /v1/studios`, `PATCH /v1/studios/:id`, `GET /v1/studios/:id/team`                                                          |
| BE-102 | P1       | `GET /v1/me/invitations`, `POST /v1/studios/:id/invitations`, `PATCH /v1/invitations/:id`                                        |
| BE-102 | P1       | `DELETE /v1/studios/:id/members/:userId`, `PATCH /v1/studios/:id/members/:userId`                                                |
| BE-102 | P1       | `GET /v1/studios/:id/resources`, `POST /v1/studios/:id/resources`, `PATCH /v1/resources/:id`, `DELETE /v1/resources/:id`         |
| BE-108 | P2       | `GET /v1/studios/:id/dashboard`                                                                                                  |
| BE-102 | P0       | `GET /v1/me/services`, `POST /v1/services`, `POST /v1/studios/:id/services`, `PATCH /v1/services/:id`, `DELETE /v1/services/:id` |
| BE-102 | P1       | `GET /v1/services/:id/add-ons`, `POST /v1/services/:id/add-ons`                                                                  |
| BE-102 | P0       | `GET /v1/tags`, `GET /v1/me/portfolios`, `GET /v1/portfolios`, `GET /v1/portfolios/:id`                                          |
| BE-102 | P0       | `POST /v1/portfolios`, `POST /v1/studios/:id/portfolios`, `PATCH /v1/portfolios/:id`, `DELETE /v1/portfolios/:id`                |
| BE-102 | P0       | `POST /v1/portfolios/:id/images`, `PATCH /v1/portfolio-images/:id/tags`                                                          |
| BE-103 | P0       | `POST /v1/uploads`                                                                                                               |
| BE-103 | P0       | `GET /v1/creative-projects`, `POST /v1/creative-projects`, `GET /v1/creative-projects/:id`, `PATCH /v1/creative-projects/:id`    |
| BE-103 | P0       | `GET /v1/creative-projects/:id/references`, `GET /v1/creative-projects/:id/artifacts`                                            |
| BE-104 | P0       | `POST /v1/search`, `POST /v1/portfolio-images/:id/index`, `GET /v1/me/ai-usage`                                                  |
| BE-105 | P0       | `GET /v1/bookings`, `POST /v1/bookings`, `GET /v1/bookings/:id`, `GET /v1/bookings/:id/workspace`                                |
| BE-105 | P0       | `POST /v1/bookings/:id/transitions`, `PATCH /v1/bookings/:id/schedule`                                                           |
| BE-105 | P0       | `POST /v1/bookings/:id/brief-versions`, `POST /v1/bookings/:id/brief-versions/:briefId/approve`                                  |
| BE-105 | P1       | `GET /v1/me/schedule`, `POST /v1/me/schedule/blocks`, `DELETE /v1/me/schedule/blocks/:id`                                        |
| BE-106 | P1       | `POST /v1/shoot-rooms/:id/messages`, `POST /v1/shoot-rooms/:id/milestones`, `PATCH /v1/shoot-rooms/:id/milestones/:milestoneId`  |
| BE-106 | P1       | `POST /v1/shoot-rooms/:id/decisions`, `PATCH /v1/shoot-rooms/:id/decisions/:decisionId`                                          |
| BE-106 | P1       | `POST /v1/bookings/:id/gallery-images`, `POST /v1/bookings/:id/selections`, `POST /v1/bookings/:id/selections/reopen`            |
| BE-106 | P1       | `POST /v1/bookings/:id/deliveries`, `POST /v1/bookings/:id/reviews`, `GET /v1/me/timeline`                                       |
| BE-107 | P2       | `POST /v1/creative-projects/:id/assistant`, `POST /v1/creative-projects/:id/chat`                                                |
| BE-107 | P2       | `GET /v1/creative-projects/:id/messages`, `GET /v1/creative-projects/:id/actions`                                                |
| BE-107 | P2       | `POST /v1/ai-actions/:id/confirm`, `POST /v1/ai-actions/:id/reject`                                                              |
| BE-107 | P2       | `GET /v1/creative-projects/:id/ai-jobs`, `POST /v1/creative-projects/:id/ai-jobs`, `GET /v1/ai-jobs/:id`                         |
| BE-108 | P2       | `POST /v1/reports`, `GET /v1/admin/reports`, `PATCH /v1/admin/reports/:id`, `POST /v1/admin/moderation`                          |

BE-104 uses the queue/index substrate required for indexing ahead of BE-107's general
AI jobs UI. Khai and Nguyen agree that shared boundary during BE-101. Public config
and OpenAPI access must be reconciled with the actual reference route registration,
because the current contract's public-route paragraph omits them. Register static
`/photographers/me` before `/:id` and test both paths.

## 4. Business rules and acceptance by slice

### Identity and authorization

- Verify the Supabase token and email status server-side. Derive the actor from verified
  identity. Test expired tokens, forged IDs/metadata, unverified email and missing profile.
- Preserve `profiles.id = auth.users.id`. Only client/photographer onboarding is public.
  Photographer capability derives from its row, manager from current membership and
  admin from manual provisioning.
- GET own profile is read-only in the MVP reference. POST profile retries return the
  existing own profile, and competing normalized usernames map to 409 with
  `user_name_taken`. Missing profile uses 404 with `profile_required`.
- Khai, Ly and Khoa record the chosen initialization mechanism before implementing it.
  [ADR 0003](../adr/0003-auth-profile-initialization.md) remains Proposed and suggests
  `/me/onboarding`, while the reference UI calls `POST /me`. Reconcile that difference
  explicitly. Test response loss and concurrent same-user creation.

### Provider and catalog

- Create studio plus first manager atomically. Enforce photographer membership,
  recipient-only invitation response, last-manager protection and active-assignment
  departure protection.
- Enforce exactly one personal/studio owner for services, portfolios and bookings.
  Current manager or personal owner performs writes. A removed manager loses new access.
- Public reads/search exclude hidden/deleted providers, drafts, hidden images and inactive
  services. Soft deletion follows the existing table rules and 30-day portfolio cleanup.
- Catalog mutations invalidate search eligibility immediately. Recheck visibility during
  result construction and indexing. A stale vector cannot restore hidden content.
- GET tags retains its current wire shape. Taxonomy expansion follows AIS-103 and DB-103.

### Uploads and projects

- Validate decoded bytes, supported MIME, owner-prefixed object path, allowed bucket and
  scope before association. Reject arbitrary remote URLs and cross-user search uploads.
- Reference upload limits are 20 MB input, 40 million pixels, 1280px preview and 320px
  thumbnail. Match Storage bucket caps in the Database guide. Retain original delivery
  constraints and provenance labels.
- Stage upload/registration so a DB failure leaves a retryable state and a scoped orphan
  cleanup path. A repeated association cannot duplicate an image.
- Projects are owner-scoped with explicit version increments. Validate reference/artifact
  ownership, selected-artifact count and eligible project relationship.
- Issue private signed URLs only after current access checks, with the reference five-minute
  lifetime. Public portfolio objects retain public object access after API hiding.

### Booking, schedule and brief

- Client owns the project and may create one booking per project. Reject self-booking,
  foreign/inactive add-ons, invalid intervals and hidden providers. Snapshot service,
  add-on prices and provider identity in the creation transaction.
- Implement `pending -> confirmed -> in_progress -> proofing -> delivered -> completed`
  plus valid rejection/cancellation branches. Transitions use actor/state/version checks
  from the reference SQL. Cancellation from proofing is prohibited.
- Confirmation/reschedule reserves photographer and studio resources in one transaction.
  Use row/advisory locking and GiST exclusion constraints. Verify two concurrent
  confirmations for one slot, assignment versus member removal, stale version 409 and
  complete rollback after resource conflict.
- Starting requires the agreed brief under the reference rules. Replacing an agreed
  brief requires both parties, and the prior agreement remains effective until then.
- Workspace projects only permitted room/gallery/delivery rows for the current actor
  and booking state. Test removed/unassigned members through API and direct Cloud reads.

### Room, delivery and AI

- Participants post room messages and manage eligible decisions/milestones. Client owns
  selections by gallery round, provider uploads/delivers, and reopen creates the intended
  selection-round state. Delivery/completion gates and one lifetime review per booking
  are enforced in DB and service code.
- Search precedence is explicit filter, then allowed parsed filter, then absence.
  `ignoreParsed` disables the named inferred component. Ranking uses only compatible
  model/pipeline vectors and visible published images, grouped by provider.
- Index jobs are idempotent, recheck publication/access when claimed and upsert compatible
  vectors. A repeated job cannot duplicate image embeddings or charge blindly.
- AI actions are proposals with expiry and source versions. Confirmation re-enters normal
  business services. Worker rechecks access. Unknown paid-provider outcomes retain the
  reservation and enter `uncertain` pending reconciliation.
- Chat needs the UI-message stream used by the reference browser client. BE-107 freezes
  stream/error/cancel handling before implementing the transport.

Use [service specifications](service-specifications.md) for the reference file mapping
and [authorization matrix](authorization-matrix.md) for the actor-by-action checks.

## 5. Coding conventions and agent workflow

| Area       | Required convention and evidence                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime    | Node 22, pnpm 9.15.0, strict TypeScript, named ESM exports and `.js` relative imports. Build shared before consumers.                                                                                                                                          |
| Structure  | Thin Fastify route modules, business services, repositories, validated `config/env.ts`, cross-cutting plugins. Keep `buildApp` injectable and listening in `server.ts`.                                                                                        |
| Naming     | camelCase values/functions, PascalCase types, UPPER_SNAKE_CASE constants, descriptive kebab-case TS filenames, plural `/v1` resource names.                                                                                                                    |
| Validation | Shared Zod body/query/param schemas, UUID IDs, bounded pagination and arrays. Explicitly settle unknown-key stripping versus rejection with Khoa and encode it in tests.                                                                                       |
| Protocol   | Preserve `{data}` and search's extra metadata. Health stays `{ok:true,service:'api'}`. Document special 200 POSTs, normal 201 creates, 202 queued jobs and 204 deletes.                                                                                        |
| Errors     | `{error:{code,message,details:[]}}`, stable reason strings and existing code mapping. Include invalid input, 401, 403, 404, 409, 422 and dependency failures. Audit MVP 502 model failures against the reconstruction contract's 503 convention during BE-101. |
| Logging    | Fastify structured logger, redacted credentials and private payloads. ESLint rejects `console`. Parameterize SQL. Transaction-local actor claims must be cleared automatically when pooled connections return.                                                 |
| Format     | English code/comments/docs/commits, single quotes, semicolons in code, two spaces, 100 columns, trailing commas, UTF-8 and LF. Product translations stay in dedicated locale modules.                                                                          |
| Contracts  | Import browser contracts from `@frameroom/shared`. Publish complete request/success/error OpenAPI schemas. Generate DB types after Cloud verification.                                                                                                         |

Each human starts one coding-agent task with its `plans/tasks/<ID>.md`, acceptance
criteria, allowed paths, source SHA and exact checks. Load the repo contract-change
skill for behavior changes and migration skill for SQL. Ask the agent to inspect
callers before editing, then review the diff and actual command evidence. Keep secrets
in local configuration and private distribution channels.

Example prompt for BE-104 follows.

```text
Read agents/README.md and plans/tasks/BE-104.md.
Implement the assigned search adapter on the current dev-based task branch.
Inspect the MVP search service at 66f3779 and current shared/browser callers.
Use docs/ai/ai-search-work-plan.md for model and data contracts.
Own apps/api search routes/services/repository integration only.
Coordinate shared exports with Khoa and SQL with Ly.
Verify filter precedence, private-image denial, vector mismatch and timeouts.
Record exact checks and unresolved dependencies in the handoff.
```

## 6. Git, commit hooks and verification

Create each branch from updated `dev` after preserving local work. Dependent tasks
start after their prerequisite merges, or use a documented stacked PR that is retargeted
to `dev` after its parent merges. Merge reviewed PRs into `dev`.

```powershell
git status --short --branch
git fetch origin --prune
git switch dev
git pull --ff-only origin dev
git switch -c feature/BE-104-ai-search-adapter
pnpm --version
pnpm install --frozen-lockfile
```

Commit syntax is `<type>(<scope>): imperative english subject [TASK-ID]`. Allowed
scopes are `web`, `api`, `ai`, `db`, `shared`, `ci`, `docs`, `deps`. Keep the entire
header at most 72 characters. The trailing ID is required by the custom commitlint
rule. Valid examples follow.

```text
feat(api): verify profile initialization [BE-101]
feat(api): add provider search adapter [BE-104]
fix(api): reject overlapping reservations [BE-105]
docs(docs): define mvp work allocation [PLAN-001]
```

`.husky/pre-commit` runs `pnpm exec lint-staged`. Staged JS/TS runs ESLint fixes and
Prettier. Staged Markdown/JSON/YAML/CSS/HTML runs Prettier. SQL and Python need their
own checks. `.husky/commit-msg` runs `pnpm exec commitlint --edit "$1"`.
Validate a candidate message before committing when needed.

```powershell
'feat(api): add provider search adapter [BE-104]' | pnpm exec commitlint
pnpm check
pnpm --filter api start
```

The final command starts the compiled API after the build in `pnpm check`. Stop it
after a health request. `pnpm check` covers formatting, docs, ESLint, typecheck,
Vitest and build. Add injection, SQL concurrency and two-account integration evidence
for the implemented slice. Python and Cloud tests have separate commands in their
guides. Root checks alone cover neither of those integrations.

PRs include the local task, API examples, actual Passed/Failed/Blocked/Not run checks
and handoff. At least one reviewer approves. DB changes require Ly or Khai. Breaking
API changes require Khai and Khoa, plus Ly when schema changes. Keep each PR around
400 changed lines where feasible and split coherent slices. Active hosted CI is absent.

## 7. Schedule, decisions and final acceptance

| Date   | Khai                                                 | Khoi Nguyen                                  | Shared checkpoint                                                                                           |
| ------ | ---------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 12 Nov | BE-101 and public BE-102 skeleton                    | BE-103 minimum, AIS-101 contract/client      | Freeze identity, error/status/casing, search response, model choice and module ownership.                   |
| 13 Nov | BE-102 catalog, start BE-105                         | Finish uploads/projects, wire BE-104         | Cloud catalog plus first 20 permitted images indexed. FE can fetch actual providers.                        |
| 14 Nov | BE-105 race/brief tests, start BE-106 if core passes | BE-104/AIS-104 integration and failure cases | 100-200 unique indexed images, bilingual search and auth demo. Reassign spare capacity to failing P0 tasks. |
| 15 Nov | Core fixes, room/delivery slice if ready             | AIS-105 evaluation and integration fixes     | Run whole-team acceptance with Khoa, Ly and Quynh Anh. Record incomplete P1/P2 tasks individually.          |

Before dependent code, record decisions in the task and affected existing documents.

| Decision                                                                         | Owners                        | Needed by                |
| -------------------------------------------------------------------------------- | ----------------------------- | ------------------------ |
| Auth initialization, verified email and read-only GET, historical questions 1/2  | Khai, Ly, Khoa                | BE-101, DB-102           |
| Existing casing, POST status exceptions, config/OpenAPI access and error mapping | Khai, Khoa, Nguyen            | BE-101                   |
| Python boundary, model revision, 768 dimensions, preprocessing and cost owner    | Nguyen, Quynh Anh, Ly         | AIS-101, DB-103, BE-104  |
| Room participants, cancellation/completion gates, round history and retention    | Khai, Ly, Khoa, product owner | DB-104, BE-105/106       |
| Image search availability and search-upload retention, historical question 16    | Quynh Anh, Khai, Khoa         | Image-search integration |

Keep historical question numbers in [API draft](../api/contract_v0.md) and
[ERD draft](../db/erd_v0.md). The user prioritizes search in this milestone, superseding
older deferred-AI scheduling. Owners record unresolved product choices with their
proposed handling in the relevant implementation task.

The 15 November review checks these concrete outcomes.

- [ ] New verified client and photographer can initialize/recover their own profiles.
- [ ] Providers can publish permitted portfolio media, and unrelated users see public projections.
- [ ] Text AI Search returns actual ranked provider cards, visual evidence and correct filters.
- [ ] Project/booking creation, brief agreement and schedule conflict handling pass on Cloud.
- [ ] Private data stays isolated through API, Storage and direct authenticated reads.
- [ ] P0 PRs have local evidence and reviewer approval, with FE integrated per its manifest.
- [ ] Every P1/P2 task has an owner, implementation state and next action.

Planning evidence is tracked in [PLAN-001](../../plans/tasks/PLAN-001.md).

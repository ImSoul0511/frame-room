# FrameRoom contribution rules

Rules apply to humans and agents. Current user instructions take precedence; update affected documentation with the change. **All documentation outside report/ must be English.** Reports retain their existing language. Code, identifiers, technical comments, and commits are English. Product strings belong in matching English and Vietnamese dictionaries; English is the default. Components subscribe through useStrings(), and requests carry the selected language to AI services.

## 1. Git workflow

### Start every session

1. Confirm the root; run git status --short --branch and inspect existing commits/changes.
2. Run git fetch origin --prune. Report failures and never claim local refs are current when fetching fails.
3. Preserve existing changes. No reset --hard, overwriting checkouts, stashing others' work, amending others' commits, or force-pushing.
4. Work on a task branch. Rebase only with a clean tree and no risk of overwriting work.
5. Never commit or push directly to main/dev.

| Branch                        | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| main                          | Stable demo/submission; reviewed PRs only            |
| dev                           | Integration; reviewed PRs only                       |
| feature/<TASK-ID>-description | Feature from dev                                     |
| fix/<TASK-ID>-description     | Fix from dev                                         |
| chore/<TASK-ID>-description   | Tooling/docs/refactor from dev                       |
| hotfix/<TASK-ID>-description  | Urgent fix from main; reviewed PRs into main and dev |

Use lowercase hyphen-separated descriptions and uppercase task IDs. Every task has a local artifact under plans/tasks/, using a stable ID such as SETUP-001 or AUTH-001. Jira is optional: link a real FR-123 issue when available, never fabricate one.

**One-time SETUP-001 exception:** chore/SETUP-001-workspace-foundation starts from current main, which contains newer design documents than dev. Open its reviewed PR into main, then synchronize main into dev through a separate reviewed PR before normal dev-based tasks resume. Neither PR may merge without approval.

Keep branches short-lived; delete after merge. Work one agent task at a time. Parallel agents require explicit authorization and separate ownership/worktrees.

### Commits and PRs

Conventional Commit format:

```text
<type>(<scope>): imperative english subject [TASK-ID]
```

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
Optional scopes: web, api, ai, db, shared, ci, docs, deps.
Header: at most 72 characters, lowercase subject, no period before the task reference.
Example: `chore: establish workspace foundation [SETUP-001]`.
Breaking changes use ! and a BREAKING CHANGE footer. Each commit is coherent and builds.

Pre-commit runs lint-staged with ESLint/Prettier; commit-msg runs commitlint. Hooks do not replace full checks. Do not invent Git identities or alter global identity.

Use the [PR template](../.github/pull_request_template.md). Normal PRs target dev and squash-merge after at least one reviewer approves. Do not self-merge without approval. DB changes need Ly or Khai review. Additive API changes need one reviewer; breaking changes need Khai and Khoa, plus Ly for schema changes. Link the local task, optional Jira, and actual verification.

Aim for approximately 400 changed lines excluding generated files. This approved foundation/translation pass is an explicit exception: instructions, tooling, and existing documents move together. Summarize by subsystem for review. Review within one working day; coordinate in Discord #dev. Check acceptance, correctness, edge cases, permissions, tests, and clarity. Mark optional suggestions nit:.

## 2. Local quality gates

CI/CD and staging deployment are disabled for foundation. No active workflow files exist. Local verification and reviewer approval replace CI/staging gates. Do not enable deployments or add hosted credentials incidentally.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm check
```

Check runs formatting, documentation links/translation scan, lint, typecheck, Vitest, and builds sequentially. Record Passed/Failed/Blocked/Not run with evidence. Never claim unexecuted checks passed; include the exact remaining command for blocked prerequisites.

Root ESLint/Prettier configurations apply throughout. TypeScript is strict. Prefer unknown and narrowing over any. Disable rules only with a specific reason. Formatting: single quotes, semicolons, two spaces, 100 characters, trailing commas, UTF-8, LF; batch files use CRLF.

## 3. Code organization

Use named exports, const, descriptive names, small functions, and early returns. Variables/functions use camelCase, types/components PascalCase, module constants UPPER_SNAKE_CASE, and booleans is/has/can/should. React component files use PascalCase; other TS files use kebab-case. Hooks begin with use.

Group external, internal workspace, and relative imports. Import contracts from @frameroom/shared; Node relative imports include .js. Avoid commented-out code and console.log; API logs use Fastify. Comments explain why.

Do not add dependencies/abstractions beyond the task. Never commit dependencies, builds, virtual environments, models, private data, secrets, or verification screenshots. Generated DB types are an intentional tracked source artifact.

### Frontend

React 19 function components/hooks, Astryx components/tokens first. Inspect installed CLI docs rather than guessing props. Do not run Astryx init if it recreates root instruction files.

Organize features in src/features/, reusable UI in components/, pages in pages/, and clients/config in lib/. Create folders when needed, not empty scaffolds.

Use TanStack Query for server state and shared Zod schemas for common validation. Handle loading/error/empty states. Keep components around 200 lines or less. Verify 375px and 1280px, keyboard navigation, labels, alt text, and announced status. Validate uploads client-side and server-side. Never expose service-role or other secrets.

### Backend

Keep Fastify routes thin; services hold business logic, repositories data access, config/ settings, plugins/ cross-cutting plugins. Separate app construction from listening for injection tests.

Business resources use /v1, plural kebab-case names, and Zod validation of body/query/params. Health remains GET /health with `{ ok: true, service: 'api' }`.

Business errors have this shape:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Unable to confirm the booking",
    "details": [{ "reason": "slot_overlap", "message": "This time is reserved" }]
  }
}
```

Details is always an array with optional field/reason/message. Frontends use codes/reasons, not display text. Use the contract's HTTP/code mapping, not feature-specific top-level codes. Add OpenAPI alongside business endpoint implementation.

Booking changes go through a service state machine. Multi-step writes use transactions/SQL functions. Enforce server/DB permissions even when UI controls are hidden. Log structured JSON without secrets, private request bodies, or personal data.

## 4. Database

SQL migrations are the schema source of truth; ERD is a draft until implemented/reviewed. Never change dashboard schema or edit merged migrations. Add small migrations, verify with local db:reset, generate types with db:types, and get Ly/Khai review.

Use plural snake_case tables, snake_case columns, and UUIDv7 business IDs from a migration-provided function, not gen_random_uuid(). Preserve Auth IDs/references. Document composite/FK PK exceptions. Use timestamptz with created_at/updated_at, except documented append-only events and user_roles.granted_at.

Boolean names use is_/has_; indexes/constraints use idx_/chk_/uq_/fk_. Status/classification fields use synchronized enums. Follow ERD deletion rules: soft-delete portfolios/studios/services/add-ons/resources/reviews; retain bookings and cancel by state. Portfolio cleanup waits 30 days.

Enable RLS on every public table, deny by default, and add explicit role/action policies. Verify allowed and denied access for relevant roles. Current membership/booking participation must agree across API/Storage/Realtime. Service-role keys bypass RLS and need explicit server checks.

Use tstzrange + btree_gist exclusions for schedule overlap and indexes for FK/filter/join columns. Embeddings remain separate; dimensions/HNSW wait for AI model selection.

See [local workflow](db/local-development.md). Foundation implements no business migrations/RLS. Reset destroys local data and never runs during ordinary app startup.

## 5. Optional AI and security

MVP-001 implements AI in TypeScript using AI SDK/Gateway and a persistent worker.
The Python scaffold remains outside pnpm and is not required. Keep model IDs server
configurable, validate generated output, enforce shared spend limits, and preserve
uncertain paid-call state. English is default; AI output follows selected language.
Document real evaluation evidence; keep model weights and large datasets out of Git.

Use only permitted educational media and fake accounts; record source, collected_at, license_note without personal contacts. Public portfolio URLs remain readable despite API hiding. Private media needs authorized signed URLs.

Never commit .env or service-role keys. Rotate accidentally committed credentials promptly and notify maintainers; history deletion alone is insufficient. Validate upload types/sizes/names. Add rate limits with future auth/search endpoints.

## 6. Tests, handoff, and Definition of Done

Test booking state machines, permissions, overlaps, and ranking when implemented. Bugs need regression tests. Use Vitest for TypeScript and pytest for future AI. Manual scenarios belong in verification artifacts; add Playwright when justified.

- Acceptance criteria met within scope.
- Applicable local checks pass with recorded evidence.
- Contract/shared/ERD/migrations/types stay aligned for business changes.
- DB/RLS tests have evidence or explicit prerequisite blockers.
- UI states, responsiveness, and accessibility verified where relevant.
- Documentation outside report/ is English with valid links.
- PR has reviewer approval; no self-approval, deployment, or direct protected-branch push.
- Handoff distinguishes implemented behavior, unverified work, and future features.

Task states: To Do -> In Progress -> In Review -> Testing -> Done. Done requires acceptance and reviewer approval. Jira may mirror states when linked. Keep one agent task active, document blockers, and preserve historical dates instead of treating old plans as current commitments.

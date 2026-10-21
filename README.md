# FrameRoom

FrameRoom connects clients with photographers and studios through portfolios and one workflow: discover -> agree on a Shoot Brief -> book -> collaborate -> select photos -> receive delivery -> review.

This is an internal educational project for Introduction to Software Engineering at VNU-HCM University of Science. The current implementation is a runnable foundation, not a completed product.

## Start here

**Agents: Read `agents/README.md` before working.** Supply this instruction explicitly to your assistant; there is intentionally no root AGENTS.md.

- [Product brief](docs/product/brief.md)
- [Architecture](docs/architecture/overview.md) and [ADRs](docs/adr/README.md)
- [Contribution rules](docs/contributing.md)
- [Backlog](plans/backlog.md)
- [Foundation task](plans/tasks/SETUP-001.md) and [verification](plans/tasks/SETUP-001-verification.md)
- [API draft](docs/api/contract_v0.md), [ERD draft](docs/db/erd_v0.md), and [Mermaid source](docs/db/erd_v0.mmd)
- [Local database workflow](docs/db/local-development.md)

All documentation outside `report/` is English. Reports retain their existing language. Product UI strings remain Vietnamese in a dedicated strings module.

## Stack and boundaries

| Layer     | Choice                                                                     |
| --------- | -------------------------------------------------------------------------- |
| Web       | React 19, TypeScript, Vite SPA, Astryx, React Router, TanStack Query       |
| API       | Node.js 22, TypeScript, Fastify, Zod                                       |
| Shared    | Compiled ESM package, Zod schemas and inferred types                       |
| Database  | Local Supabase PostgreSQL, Auth, Storage, Realtime; SQL migrations and RLS |
| Workspace | pnpm 9.15.0                                                                |
| Deferred  | AI implementation/model selection, pgvector, Tauri, hosting, CI/CD         |

Web/API currently communicate through GET /health. Business endpoints in the contract are planned, not implemented. No business migrations or RLS policies exist yet. The optional Python/FastAPI scaffold remains outside pnpm.

## Install and run

Requirements: Node.js 22 (minimum 22.13), Corepack, and Git. Docker Desktop's Linux engine is needed only for local Supabase. Python and cloud credentials are not needed for web/API.

From the root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Corepack reads the pinned version from package.json. Commands also work as pnpm after `corepack enable` if your Node installation permits PATH shims. No global pnpm installation is required.

The dev command builds shared, then runs its compiler watcher, the API watcher, and Vite in the current terminal. Shared changes rebuild and restart the API; Vite updates the web. Stop with Ctrl+C. It never installs Python, starts Docker, or resets a database.

| Service                       | Address                      |
| ----------------------------- | ---------------------------- |
| Web                           | http://localhost:5173        |
| API health                    | http://localhost:4000/health |
| Supabase API, when started    | http://127.0.0.1:54321       |
| Supabase Studio, when started | http://127.0.0.1:54323       |

The web reports loading, connected, or unavailable API states and supports retry. This is API liveness, not database readiness. Requests time out after five seconds and refresh every thirty seconds. Windows users may run `scripts\start-dev.bat` as a wrapper for the same development command.

## Environment

Defaults work without an environment file. To customize, run `Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` in a POSIX shell.

| Variable                    | Default / purpose                                               |
| --------------------------- | --------------------------------------------------------------- |
| HOST                        | API bind address: 127.0.0.1                                     |
| PORT                        | 4000; integer 1-65535                                           |
| WEB_ORIGIN                  | Exact origin http://localhost:5173, without path/trailing slash |
| LOG_LEVEL                   | info                                                            |
| VITE_API_URL                | http://localhost:4000                                           |
| VITE_SUPABASE_*             | Reserved for future Auth integration                            |
| SUPABASE_*                  | Reserved server settings                                        |
| AI_SERVICE_URL, LLM_API_KEY | Deferred; not required                                          |

Process variables override the API's root .env. Vite loads root environment files with its normal mode precedence; restart it after changes. Only VITE_ variables are browser-visible: never use that prefix for secrets or service-role credentials. Match API URL/port and browser URL/WEB_ORIGIN. Vite uses a strict port rather than silently changing origins.

## Commands

Use `corepack pnpm` in place of pnpm when its shim is unavailable.

| Command                                   | Purpose                                                           |
| ----------------------------------------- | ----------------------------------------------------------------- |
| pnpm dev                                  | Shared watcher + API + web                                        |
| pnpm dev:web / pnpm dev:api               | Build shared then start one app; use full dev for shared watching |
| pnpm build                                | Compile shared/API and build static web                           |
| pnpm --filter api start                   | Run built API with Node; build first                              |
| pnpm typecheck                            | Build shared and check workspace TypeScript                       |
| pnpm docs:check                           | Validate local documentation links and scan for untranslated text |
| pnpm lint                                 | ESLint; warnings fail                                             |
| pnpm format:check / pnpm format           | Check / apply formatting                                          |
| pnpm test                                 | Build shared and run Vitest                                       |
| pnpm check                                | Format -> docs -> lint -> typecheck -> tests -> build             |
| pnpm db:start / pnpm db:stop              | Start / stop local Supabase                                       |
| pnpm db:status                            | Local endpoints/credentials; do not publish output                |
| pnpm db:reset                             | Reset only local data; destructive                                |
| pnpm db:types                             | Generate DB types without overwriting them on command failure     |
| pnpm --filter web astryx component Button | Inspect installed Astryx APIs                                     |

There are no active GitHub Actions workflows or deployments. The disabled workflow is historical reference. Run local checks and include evidence in reviewed PRs.

## Repository

```text
agents/           Entrypoint, domain guides, workflow, templates
apps/web/         React/Vite SPA
apps/api/         Fastify app and server
apps/ai-service/  Optional Python scaffold
packages/shared/  Schemas/types, compiled exports
supabase/         Config, future migrations, fake seed
scripts/          Development/database commands
docs/             Product, architecture, contract, ERD, contribution rules
plans/            Backlog, task artifacts, historical plans
report/           Academic reports, preserved in their existing language
```

The [historical week-one plan](plans/week1.md) is retained for context; current backlog replaces its AI/CI/staging schedule.

## Roles and team

Clients discover, book, select photos, and review. Photographers work independently and can create/join multiple studios. Managers derive authority from current studio membership and must have a photographer profile; studios have no separate login. Only client/photographer onboarding is public. System admins are provisioned manually. Retoucher/art director are display specialties, not authorization roles.

| Member                  | Primary          | Support      |
| ----------------------- | ---------------- | ------------ |
| Phan Le Dang Khoa       | Frontend         | Tooling      |
| Nguyen Dang Khoi Nguyen | Tooling, docs    | Frontend, AI |
| Ha Thao Ly              | Database         | Backend      |
| Le Quoc Khai            | Backend          | Database     |
| Dao Thi Quynh Anh       | AI Search/CV, QA | Docs         |

## Demo media

Use synthetic accounts and permitted internal educational images. Record source, collected_at, and license_note; exclude personal contact information. The existing design accepts public portfolio-images URLs, even for drafts/demo images. API hiding cannot revoke direct Storage URLs; choose media compatible with that access.

Private brief/room/gallery/delivery files require authorization and expiring signed URLs. See contract 2.6 for paired thumbnails and image limits. No redistribution license is granted.

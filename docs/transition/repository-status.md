# Repository status (2026-11-05)

Read-only Git inspection found `main` at `a799dea`, tracking `origin/main`; local `dev` and `origin/dev` point to the same commit. The only working-tree change before this documentation work was an untracked `tasks/` directory. Preserve it; its ownership and relationship to the MVP are unverified. No branch operation was performed.

The fuller MVP is committed at `66f3779` on `feature/MVP-001-ai-focused-workflow` and `origin/feature/MVP-001-ai-focused-workflow`; its implementation commit is `d0542a2`. That feature branch contains merged `dev` history but has not been integrated into `main` or `dev`. `git log --graph --all` shows the common foundation and the feature merge. `archive/mvp` does not exist in the inspected branch list. Remote state is the locally known remote tracking state; no fetch was run.

| Component         | Checked out `main`                                                    | MVP feature branch                                                                            | Evidence                                                                         |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Web               | `/` health page, TanStack Query, Astryx, Vite                         | Auth, exploration, projects, bookings, studio, portfolio, settings, admin, English/Vietnamese | `apps/web/src/App.tsx`, branch `apps/web/src/pages/`                             |
| API               | Fastify `GET /health` only                                            | Business routes, service modules, PostgreSQL, Supabase Auth/Storage, AI SDK and worker        | `apps/api/src/app.ts`, branch `apps/api/src/routes/business.ts`                  |
| Database          | `supabase/config.toml`, placeholder `seed.sql`; no business migration | Eight SQL migrations, 34 public tables, RLS, Storage, vector and queue                        | branch `supabase/migrations/20261030*.sql`                                       |
| Python AI service | FastAPI `/health` scaffold                                            | Same scaffold; functional AI is TypeScript in API/worker                                      | `apps/ai-service/app/main.py`, branch `apps/api/src/services/ai.ts`, `worker.ts` |

`docs/api/contract_v0.md` and `docs/db/erd_v0.md` on `main` are drafts, not implemented structures. On the feature branch, `docs/api/mvp.md`, `docs/db/mvp.md`, and SQL/code are newer. The user requested a Python AI replacement, but the MVP's working AI path is TypeScript; the Python app has no NLP/CV endpoints. The feature verification report states local tests passed but paid model evaluation and human output review did not run (`plans/tasks/MVP-001-verification.md`). This documentation was based on source inspection, not a fresh runtime verification.

See [Git plan](git-transition-plan.md) for later branch operations and [roadmap](development-roadmap.md) for responsibility boundaries.

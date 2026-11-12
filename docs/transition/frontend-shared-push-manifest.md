# Frontend and shared-contract handoff manifest

**Purpose:** prepare a separate pull request containing the MVP web application, the shared wire contracts it imports, and the minimum workspace support. This is a file selection and verification guide. It does not push, merge, or deploy anything.

**Source inspected:** `feature/MVP-001-ai-focused-workflow` at `66f3779`. **Proposed target:** a new branch created from `dev` (`a799dea` in the inspected local refs), then a reviewed PR to `dev`. The current documentation branch is `chore/SETUP-001-documentation-transition`; it is not the MVP source or the proposed integration branch. Recheck remote refs before implementation because the listed SHAs are a snapshot. The MVP implementation commit `d0542a2` contains web, API, database, and AI code together: do not cherry-pick that commit or branch from the MVP tip for a frontend-only PR.

## 1. Files to transfer from the MVP commit

The following are **all paths changed under `apps/web`** between inspected `dev` and the MVP tip. Transfer them together. Files already present on `dev` but absent from this list, such as `apps/web/src/main.tsx`, `apps/web/vite.config.ts`, and `apps/web/tsconfig.json`, remain part of the app and should be retained from `dev`.

```text
apps/web/index.html
apps/web/package.json
apps/web/src/App.tsx
apps/web/src/components/AppLayout.tsx
apps/web/src/components/LanguageSwitcher.tsx
apps/web/src/components/ui.tsx
apps/web/src/features/booking/BookingControls.tsx
apps/web/src/features/booking/BookingForm.tsx
apps/web/src/features/booking/GalleryPanel.tsx
apps/web/src/features/booking/RoomPanel.tsx
apps/web/src/features/catalog/ProviderForms.tsx
apps/web/src/features/projects/BriefEditor.tsx
apps/web/src/features/projects/ChatPanel.tsx
apps/web/src/lib/api.test.ts
apps/web/src/lib/api.ts
apps/web/src/lib/auth.tsx
apps/web/src/lib/env.ts
apps/web/src/lib/format.test.ts
apps/web/src/lib/format.ts
apps/web/src/lib/hooks.ts
apps/web/src/lib/i18n.ts
apps/web/src/lib/locale-store.test.ts
apps/web/src/lib/locale-store.ts
apps/web/src/lib/types.ts
apps/web/src/locales/en.ts
apps/web/src/locales/vi.ts
apps/web/src/pages/AuthPage.tsx
apps/web/src/pages/BookingsPage.tsx
apps/web/src/pages/ExplorePage.tsx
apps/web/src/pages/HomePage.tsx
apps/web/src/pages/PortfolioPage.tsx
apps/web/src/pages/ProjectsPage.tsx
apps/web/src/pages/ProviderPage.tsx
apps/web/src/pages/SettingsPage.tsx
apps/web/src/pages/StudioPage.tsx
apps/web/src/strings.ts
apps/web/src/styles.css
```

The MVP web package adds `@supabase/supabase-js`, `@ai-sdk/react`, and `ai` to render Auth and AI chat flows. Those are **frontend dependencies** here; including them does not transfer the AI service. Preserve existing React, Astryx, Vite, Router, TanStack Query, and Zod dependencies from the web package. The complete web subtree is useful for a consistency check, but do not copy `node_modules` or `dist`.

## 2. Shared contracts required for a successful web build

Transfer exactly these changed shared source paths from the MVP tip:

```text
packages/shared/src/business.ts
packages/shared/src/locale.ts
packages/shared/src/index.ts
```

`business.ts` exports browser-used genres, validation, error, booking/project/provider, job, artifact, search, and action types. `locale.ts` supplies the language contract. `index.ts` re-exports them. The existing `packages/shared/package.json` and `tsconfig.json` on `dev` already compile this package and need no MVP copy. The web imports shared exports from `apps/web/src/components`, `features`, `lib`, and `pages` (confirmed with `git grep` on the MVP tip).

**Do not transfer `packages/shared/src/db.types.ts`:** the web does not import it; it is generated from the MVP database schema. Recreate database types later against the approved Supabase Cloud schema. Keeping AI request/response _types_ in `business.ts` is necessary for the UI to compile and does not install an AI service.

## 3. Workspace, environment, and documentation support

| Item                                                                                 | Action for the frontend PR                                                                                                                                                               | Reason                                                                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm-lock.yaml`                                                                     | Regenerate on the target branch with pinned pnpm 9.15.0 after copying `apps/web/package.json`; review the resulting diff. Do **not** copy the whole MVP lockfile.                        | The MVP lockfile also resolves backend/worker packages.                                                      |
| Root `package.json`, `pnpm-workspace.yaml`, `scripts/dev.mjs`                        | Retain the target branch versions. If the separate pnpm-tooling PR has not merged, coordinate it before this PR; do not copy the MVP root manifest wholesale.                            | The MVP root manifest adds backend/AI worker, seed, DB, and evaluation scripts, including Corepack calls.    |
| `.env.example`                                                                       | Manually add or retain `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` placeholders pointing to the intended **Supabase Cloud** setup; keep values empty/example-safe. | `apps/web/src/lib/env.ts` reads these names. Do not copy the MVP's local Supabase URL or server secrets.     |
| `docs/frontend/feature-inventory.md`, `frontend-data-flow.md`, `api-requirements.md` | Include if the documentation branch has not already merged into `dev`; otherwise link to the existing copies.                                                                            | These are the UI-to-backend handoff.                                                                         |
| `docs/backend/api-contract.md` and `endpoint-inventory.md`                           | Reference or include as documentation only, if not already merged. Mark routes as required for the future backend, not available on `dev`.                                               | Freeze the interface the web expects without transferring backend implementation.                            |
| `docs/product/brief.md` and `docs/api/mvp.md` from the MVP branch                    | Review relevant bilingual/product and wire-contract changes manually; do not blindly replace target docs.                                                                                | MVP text includes implementation and local-infrastructure claims that may be stale after the Cloud decision. |
| UI unit tests inside `apps/web/src/lib/`                                             | Include with the web paths above.                                                                                                                                                        | They check request handling, formatting, and language persistence without a business backend.                |

Do not commit a real `.env`, Supabase service-role key, database URL, AI Gateway key, generated build output, or local media/dataset. Browser `VITE_*` variables are public; use only the Cloud project's public URL and publishable/anon key there.

## 4. Explicitly outside this frontend PR

```text
apps/api/**
apps/ai-service/**
supabase/migrations/**
supabase/seed.sql
supabase/config.toml
packages/shared/src/db.types.ts
scripts/local-env.mjs
apps/api/src/demo-seed.ts
apps/api/src/index-portfolios.ts
apps/api/src/evaluate-search.ts
fixtures/search-evaluation.json
tests/e2e/mvp.spec.ts
playwright.config.ts
```

The MVP Playwright test exercises real API, Auth, database, Storage, and seeded accounts. Its config also invokes `corepack pnpm dev`. Keep that integration test for a later whole-stack PR; frontend unit tests remain in scope. Do not copy MVP `README.md`, `.env.example`, root `package.json`, or `pnpm-lock.yaml` verbatim, because they mix UI with local database and AI/worker setup. Database/AI/backend documentation may be maintained in separate handoffs, but no service source or migration belongs in this PR.

## 5. Review and verification before pushing

1. Start from a clean branch based on the latest reviewed `dev`. Preserve the existing documentation/tooling work; do not reset it. Confirm the desired source SHA with the Frontend Developer.
2. Transfer the selected web and shared paths. Integrate public Cloud environment placeholders and regenerate `pnpm-lock.yaml` on this target branch with `pnpm install --frozen-lockfile` **only after** the lockfile has been updated by a normal reviewed `pnpm install`. Never use `npm install` for this pnpm workspace.
3. Inspect `git diff --name-status` and staged paths. Every path must fit sections 1–3; no `apps/api`, `apps/ai-service`, `supabase`, generated `db.types.ts`, or real secret should appear.
4. Run `pnpm --filter @frameroom/shared build`, `pnpm --filter web typecheck`, `pnpm --filter web build`, `pnpm test`, `pnpm docs:check`, and the applicable repository checks. The baseline API health tests may run, but this does not prove business flows.
5. Smoke-test public routes, language selection, loading/error states, and keyboard/mobile layout. With no business backend, Auth profile resolution, search, project/booking writes, uploads, and AI chat cannot be accepted as working integrations. Record those gaps in the PR.
6. Open a reviewed PR to `dev` under the repository contribution rules. The Frontend Developer owns its transfer and push; this manifest does not authorize an agent to push it.

**Integration gate:** Backend and Database Developers later implement the frozen contract and Cloud schema; only then run the deferred end-to-end booking, media, authorization, and AI tests. A passing frontend build is a valid early handoff milestone, not evidence that the full product works.

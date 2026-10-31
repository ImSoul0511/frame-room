# SETUP-001: Verification

Date: 2026-10-21 (project timezone Asia/Bangkok).
Environment: Windows PowerShell, Node 22.19.0, Corepack 0.34.0, pnpm 9.15.0, headless Microsoft Edge.
Revision: SETUP-001 implementation on chore/SETUP-001-workspace-foundation.

Draft PR: [#2](https://github.com/ImSoul0511/frame-room/pull/2). Implementation commit: 35783e5. Both pre-commit lint-staged and commit-msg validation passed during the actual implementation commit. Only the task branch was pushed.

## Automated evidence

| Check                              | Status  | Evidence                                                                                                                                             |
| ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen-lockfile installation       | Passed  | corepack pnpm install --frozen-lockfile                                                                                                              |
| Combined checks                    | Passed  | corepack pnpm check; format, lint, TypeScript, 11 Vitest tests, shared/API/web builds                                                                |
| Clean source snapshot              | Passed  | Copied 83 source files without dependencies/builds into ignored .artifacts/clean-checkout; frozen install and full check including docs:check passed |
| Documentation                      | Passed  | 28 Markdown files: relative links/anchors and untranslated-text scan; manual English review outside report                                           |
| API preservation                   | Passed  | Compared original/current GET/POST/PATCH/PUT/DELETE endpoint sets: no removals/additions                                                             |
| ERD synchronization                | Passed  | Embedded diagram equals erd_v0.mmd after excluding source comments                                                                                   |
| Git whitespace/report preservation | Passed  | git diff --check; no report/ changes                                                                                                                 |
| Commit validation                  | Passed  | Accepted Conventional Commit with SETUP-001; rejected a header lacking task reference                                                                |
| Supabase CLI/config parsing        | Passed  | Pinned CLI 2.121.0 runs and parses updated config before Docker prerequisite failure                                                                 |
| Database start                     | Blocked | DockerLifecycleInspectError: Docker Desktop Linux engine named pipe is unavailable                                                                   |
| Database reset/RLS                 | Not run | Engine unavailable; no business migrations or RLS policies exist yet                                                                                 |
| Reviewer approval / dev sync       | Not run | Requires reviewed PR and subsequent merge                                                                                                            |

Vitest covers health schema/response, allowed and rejected CORS origins and preflight, invalid port/origin settings, default startup without DB/AI keys, browser response validation, and HTTP failures.

## Runtime and browser evidence

| Scenario                      | Status | Evidence                                                                                                                                                           |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full development startup      | Passed | corepack pnpm dev starts shared watcher, API, and web without Python/Docker                                                                                        |
| Shared source propagation     | Passed | Temporary source comment rebuilt shared, Vite reported HMR, tsx restarted API, health recovered; source restored byte-for-byte                                     |
| Development shutdown          | Passed | Ctrl+C stopped the task processes; ports 4000/5173 no longer listened                                                                                              |
| Compiled API                  | Passed | Node ran apps/api/dist/server.js from a different working directory and returned the unchanged health response                                                     |
| Root environment / precedence | Passed | Temporary root .env loaded from unrelated cwd; explicit process PORT took precedence; invalid PORT failed startup with configuration error; temporary file removed |
| Type generation failure       | Passed | db:types failed without Docker and preserved an existing sentinel file; sentinel removed/restored afterward                                                        |
| 375px and 1280px              | Passed | Viewport/content widths matched, Astryx button styles resolved, API success visible; both screenshots visually inspected                                           |
| Browser states                | Passed | Held request showed loading; failed request showed error; keyboard Tab/Enter retry recovered success                                                               |
| Routing                       | Passed | Unknown route displayed recovery link; link returned home with healthy state                                                                                       |
| Browser errors                | Passed | No uncaught page errors in tested scenarios                                                                                                                        |

Browser test tools and screenshots are ignored local artifacts, not committed dependencies or deliverables. Evidence images: .artifacts/web-375.png and .artifacts/web-1280.png. The flow is browser -> API -> shared validation -> response/status; health does not exercise a database.

## Limitations and next checks

- Start Docker Desktop's Linux engine, then run corepack pnpm db:start. Deliberately run corepack pnpm db:reset only when local data may be discarded.
- Database replay, generated DB types, and real RLS tests remain future evidence; foundation creates no business schema.
- Vite build succeeds with a non-failing >500 kB chunk warning (main JS about 556 kB, gzip about 167 kB). Consider bundle optimization in a dedicated task.
- PR approval is required before merge. After the approved setup merges to main, synchronize main to dev through a reviewed PR.

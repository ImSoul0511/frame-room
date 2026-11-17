# BE-101: Verification and handoff

Date: 2026-11-17, Asia/Saigon
Environment: Windows, Node 22.20.0, pnpm 9.15.0
Revision: review corrections on top of `2b5b542`, published through PR #6.

## Executed checks

| Check/scenario                                   | Status  | Evidence                                                                                                    |
| ------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile --offline=false` | Passed  | Lockfile unchanged; dependencies installed in an isolated temporary worktree                                |
| `pnpm check`                                     | Passed  | Format, docs, lint, typecheck, 9 test files / 76 tests, API/shared/web build                                |
| Profile response envelopes                       | Passed  | Exact `{data: profile}` and `{data: null}` injection assertions                                             |
| OpenAPI                                          | Passed  | Both profile create/retry statuses, missing-profile 404, bodyless 204 documented                            |
| Transaction lifecycle                            | Passed  | Mocked PostgreSQL client verifies transaction-local claims, commit, rollback and release on failures        |
| Compiled Node startup                            | Passed  | See smoke procedure below; liveness/config/OpenAPI/404 assertions run against a temporary local server      |
| Cloud Auth/database/RLS                          | Not run | Explicitly deferred by user on 2026-11-17; DB-101/DB-102 and a designated test project remain prerequisites |
| Full frontend integration                        | Not run | Frontend/shared handoff and owner compatibility review remain pending                                       |

The existing Vite chunk-size warning is non-fatal. A restricted-shell attempt hit
`spawn EPERM`; the full check subsequently ran successfully with subprocess access.
The transaction test uses a mocked client and does not establish PostgreSQL/RLS behavior.

## Reproduce

```powershell
pnpm install --frozen-lockfile
pnpm check
```

Compiled smoke procedure: start `apps/api/dist/server.js` on a free loopback port,
request `/health`, `/v1/config`, `/v1/openapi.json` and an unknown route, assert
status/payloads, then terminate the temporary server. No Cloud credentials are needed.

## Remaining work

- Khai/Ly/Khoa: accept the identity initialization decision; keep ADR 0003 Proposed
  until that acceptance is recorded.
- Khoa: review the shared export and six identity wire responses with the browser caller.
- When the user resumes Cloud work: supply the designated test configuration, verify
  DB-102 schema, then exercise real expired/unverified tokens, same-user profile retries,
  competing normalized usernames, rollback and two-account isolation.
- Obtain at least one independent reviewer approval before merge. Local passes do not
  make this task Done.

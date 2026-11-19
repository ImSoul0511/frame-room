# BE-108: Verification

Date: 2026-11-20, Asia/Saigon
Environment: Windows, Node 22.20.0, pnpm 9.15.0
Revision: `feature/BE-108-moderation` based on `dev`.

## Scope

Route-level integration tests (`apps/api/src/routes/moderation.test.ts`) and task
documentation (`plans/tasks/BE-108.md`) covering all 5 BE-108 endpoints.

## Checks

| Check/scenario                     | Status  | Evidence                                                        |
| ---------------------------------- | ------- | --------------------------------------------------------------- |
| `pnpm check`                       | Passed  | Format, docs, ESLint, typecheck, Vitest, and build green        |
| Studio dashboard (`GET`)           | Passed  | Verified manager stats/upcoming/resources and `403` denial      |
| Content reports (`POST/GET/PATCH`) | Passed  | Verified user report creation, validation, and admin resolution |
| Admin moderation (`POST`)          | Passed  | Verified `403` non-admin denial, portfolio status & `is_hidden` |
| Cloud database/RLS                 | Not run | Deferred per work plan                                          |

## Remaining work

Local transaction mocks verify route validation, HTTP status mapping, and authorization
guards. Coordinate Cloud `is_admin()` claim and catalog hiding verification with Ly.

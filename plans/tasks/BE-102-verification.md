# BE-102: Verification and handoff

Date: 2026-11-17, Asia/Saigon
Environment: Windows, Node 22.20.0, pnpm 9.15.0
Revision: review corrections on top of `de355ea`, with updated BE-101 parent
`c2b2231` merged into the PR #7 branch.

## Executed checks

| Check/scenario                               | Status  | Evidence                                                                                                                                                                        |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency install                           | Passed  | Frozen install; then pinned `sharp@0.35.5` matching the MVP reference for required image-byte verification                                                                      |
| `pnpm check`                                 | Passed  | Format, docs, lint, typecheck, 11 test files / 141 tests, shared/API/web build                                                                                                  |
| Photographer-only studio creation            | Passed  | Injection test rejects a client before either studio/member insertion                                                                                                           |
| Membership permission after waiting for lock | Passed  | PATCH/DELETE regression tests simulate management rights being revoked during the wait                                                                                          |
| Catalog contract compatibility               | Passed  | Shared input schemas reused; portfolio detail returns `{data:{portfolio,images}}`; image-registration request does not require client dimensions                                |
| Image scope and bytes                        | Passed  | Tests reject foreign/remote/traversal/thumbnail paths; mocked Storage with actual Sharp-generated bitmaps verifies dimensions, WebP, thumbnail, missing/corrupt/oversized files |
| Compiled Node startup                        | Passed  | Temporary loopback server smoke: health, safe config, OpenAPI and 404 error envelope                                                                                            |
| Database/RLS/real locking                    | Not run | User explicitly deferred Supabase Cloud verification; local repository mocks cannot establish PostgreSQL concurrency guarantees                                                 |
| Real Storage and frontend upload flow        | Not run | User deferred Cloud; needs DB-102/buckets and the BE-103 upload endpoint                                                                                                        |
| Independent review                           | Not run | Requested reviewers must assess the updated PR                                                                                                                                  |

Existing Vite chunk-size warning remains non-fatal. No database, Cloud project, bucket,
RLS policy or hosted workflow was changed or deployed.

## Contract impact

| Layer    | Result                                                                                            | Compatibility and remaining review                                                   |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| API      | Portfolio detail and identity envelopes match the MVP UI; image dimensions come from stored bytes | Injection/OpenAPI checks pass; full browser integration pending                      |
| Shared   | Existing catalog inputs reused; own-photographer export inherited from BE-101                     | Khoa reviews wire shapes; API-specific projections remain local                      |
| SQL/RLS  | No migration or generated DB type added; manual tag replacement preserves AI tags                 | Real DB authorization/locking and DB-102 compatibility still unverified              |
| Storage  | Fixed public portfolio bucket; caller/portfolio prefix; validate decoded main and thumbnail bytes | Downloads are mocked in tests; actual object access and upload writes deferred       |
| Frontend | No browser source changed                                                                         | Existing image-registration payload accepted locally; BE-103/Cloud needed end to end |

## Reproduce

```powershell
pnpm install --frozen-lockfile
pnpm check
```

The compiled-server smoke starts `apps/api/dist/server.js` on a temporary local port,
asserts liveness/config/OpenAPI/404 responses and stops the process afterwards.
No Cloud requests are made by that smoke.

## Remaining work

- Review and accept BE-101/PR #6 first; then retarget this PR to `dev`.
- Khoa: review browser/shared contracts and the API-specific response projections.
- Ly/Khai: verify the actual DB-102 schema, `public.providers`, transaction rules and
  generated DB types when Cloud verification resumes.
- BE-103: provide the upload endpoint and paired normalized WebP files before the
  complete browser upload/association flow can be accepted.
- When the user resumes Cloud work, exercise real visibility filters, two-account
  authorization, member demotion/removal races, invitation races, Storage denial,
  image association and rollback. No such integration pass is claimed here.
- Obtain independent reviewer approval before merge. Keep the task In Review.

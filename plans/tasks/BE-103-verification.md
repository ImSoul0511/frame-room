# BE-103: Verification

Date: 2026-11-18, Asia/Saigon
Environment: Windows, Node 22.20.0, pnpm 9.15.0
Revision: BE-103 working tree on top of `b73fc12`.

## Scope

Only upload/media and project implementation is retained. The newly authored AI
client/search/jobs/actions/worker/import code and AI SDK dependency were discarded
at the user's request. Ownership notes assign all AI work to Quynh Anh.

## Checks

| Check/scenario             | Status  | Evidence                         |
| -------------------------- | ------- | -------------------------------- |
| `pnpm check`               | Not run | Final narrowed-scope run pending |
| Compiled Node smoke        | Not run | Final narrowed-scope run pending |
| Cloud database/RLS/Storage | Not run | Explicitly deferred by the user  |
| AI/model calls             | Not run | Outside BE-103 scope             |

## Remaining work

Existing Vite chunk-size warning is non-fatal. Test coverage includes MIME/bytes
validation, real synthetic image normalization and thumbnail cleanup, foreign project
write/artifact/reference denial, multipart input and shared response envelopes.

Local repository/Storage
mocks do not establish real SQL/RLS or Cloud behavior. Review schema compatibility
with Ly, upload/booking permissions with Khai and browser contracts with Khoa.

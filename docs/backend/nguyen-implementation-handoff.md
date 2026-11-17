# BE-103: Media and creative projects handoff

Updated 2026-11-18. Owner: Khoi Nguyen. User-authorized target: `dev`.
This change depends on the existing BE-101/102 API foundation from PR #6/#7.

## Scope and ownership

Khoi Nguyen implements BE-103 only: uploads/media, project CRUD and private
reference/artifact projections. Quynh Anh owns all AI tasks, including AIS-101 through
AIS-105, BE-104 and BE-107. The newly authored AI runtime code was discarded before
commit at the user's request. No AI SDK, model client, search adapter, worker,
index/import CLI or AI job/action route is part of this change.

Existing project artifact selection/read fields are retained for wire compatibility.
They do not execute AI jobs or generate content. No Python source, SQL migration,
Cloud project or Storage policy is changed.

## Implemented operations

- `POST /v1/uploads`: one multipart file, authenticated before reading bytes;
  bucket/scope authorization, MIME/decoded-format agreement, 20 MiB input and
  40-million-pixel cap.
- Normalized uploads create a maximum 1280px WebP plus a 320px paired thumbnail,
  with two-MiB limits, stripped incidental metadata and UUIDv7 filenames.
- Portfolio paths include caller/portfolio IDs. Booking/gallery/delivery and room
  uploads check the current permitted scope and workflow state.
- Failed thumbnail writes clean up the paired main object, or report cleanup required.
  Successful uploads can be retried for association if a later DB registration fails.
- `GET/POST /v1/creative-projects`, `GET/PATCH /v1/creative-projects/:id`:
  reads use current project access; writes require the owner, reject closed projects,
  validate selected artifacts/references and increment version.
- Project references/artifacts issue private signed URLs for five minutes, only
  after project access is checked.

Business responses use the shared `{data: ...}` envelope. Multipart upload input and
success/error schemas are documented in OpenAPI.

## Reproduce

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm --filter api start
```

The final command starts the compiled API after build. Missing Storage/DB configuration
returns explicit dependency errors. API startup does not start a worker or model.

## Dependencies and limitations

Cloud verification remains deferred by the user. Local tests use fake repositories,
database transactions and Storage responses; image normalization uses real synthetic
bitmap bytes through Sharp. These tests do not establish Cloud RLS, SQL helper or
PostgreSQL concurrency correctness.

Ly must provide the accepted schema/helpers, Storage buckets/policies and generated
types. Project artifact selection follows the reference `selected_artifact_ids`
schema. Khai reviews booking/room authorization; Khoa reviews browser/shared contracts.
The ordinary upload path is implemented, but physical retention/cleanup of abandoned
successful uploads still needs the agreed operational policy.

See [verification](../../plans/tasks/BE-103-verification.md). Keep In Review until
independent review and required integration acceptance are recorded.

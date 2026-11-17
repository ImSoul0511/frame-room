# DATA-002: Local dataset curation website

Status: In Review
Branch: crawler (existing user task branch; unrelated work preserved)
Jira: Not linked

## Scope and accepted decisions

The user requested a separate website for organizing scraped images by synthetic photographer, treating each portfolio as an album/post with its images and description. Supported edits include names/descriptions, ordering, manual tags and deletion. The user explicitly selected local execution rather than hosting. Reversible archival implements deletion; no source media or Auth identities are permanently removed through the UI.

## Implementation

- [Local server](../../scripts/dataset_studio.py): loopback-only Python HTTP server, existing server-side Supabase credentials, scoped snapshots, validation and service-only RPC writes. It builds the separate entry on demand.
- [Standalone React entry](../../apps/web/dataset-studio.html), [build configuration](../../apps/web/vite.dataset-studio.config.ts), and [workspace](../../apps/web/src/dataset-studio/Studio.tsx): photographer sidebar, album cards, full-image inspection, multi-select, move/order/tag/review operations, tag library and Trash.
- [Additive migration](../../supabase/migrations/202611160003_dataset_studio.sql): profile/album sort fields and atomic dataset-scoped transaction RPC. Existing IDs, main web/API routes, RLS policies and Storage access are preserved.
- [Usage/API contract](../../docs/ai/dataset-studio.md) and [offline tests](../../scripts/test_dataset_studio.py).

## Contract and access mapping

| Layer                      | Existing behavior                            | Tool addition / compatibility                                                         |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Main web and `/v1` API     | Foundation / product reconstruction contract | No route or role changes                                                              |
| Local browser API          | New standalone tooling surface               | Read-only bootstrap plus nonce/origin protected action endpoint                       |
| Shared schemas             | Only foundation schemas implemented          | Local curation response validation/types; no invented product business exports        |
| Profiles / albums / images | Existing demo dataset identity and relations | Only dataset-marked photographer records and their child albums/images may be curated |
| Tags                       | Shared bilingual catalog                     | Custom tags and retirement preserve image-tag references                              |
| Database writes            | REST and existing user policies              | One service-role-only transaction RPC; ordinary browser roles are denied              |
| Storage                    | Existing public portfolio bucket             | Stable file paths; no upload/move/delete on curation                                  |

The server binds `127.0.0.1`, validates Host/Origin, and requires an in-memory custom header for writes. No Supabase secret appears in frontend source, build inputs, API output or URL query parameters. All image/tag/caption mutations are atomic in the RPC, with scoped selection checks before changes commit. Ordinary client tokens cannot execute it. Application UUID defaults remain authoritative; album request UUIDs are idempotency keys rather than business IDs.

## UI and state coverage

- Explicit loading, connection failure/retry, empty profiles/albums/images/tags, migration-required and read-only states.
- Mutation controls disable while saving; an error retains the editing form and selection.
- Native dialogs provide focus trapping and Escape support; dirty image/form close requests can confirm discarding changes. Buttons have labels and image checkboxes have accessible names.
- Profile/album/image order persists; image order is limited to a complete unfiltered album. First image defines its cover.
- Responsive CSS targets desktop and 375px widths; actual browser layout and keyboard-only completion remain unverified in this tool session because no browser surface was available.
- Astryx Button/TextInput API documentation and installed component sources were inspected. Existing neutral Theme/CSS is reused. Image-grid, native dialog and tag-picker layout use scoped custom CSS.

## Verification

- TypeScript compile and separate Vite build passed. The host runs Node 24; the root project engine remains Node 22 and was not changed. Dedicated commands used the installed tool binaries directly.
- Scoped ESLint passed. The combined offline run passed 45 tests: 14 local-server/validation/access checks and 31 collector/importer checks, including preserving an archived intake album and recovering its replacement inbox.
- Live Cloud/HTTP fixture checks passed 12 cases: album creation with idempotent retry; album title/description editing; atomic image caption/manual tags/review save; rollback on invalid tags; bulk tag add/remove; image move/order; image archive/restore; album archive/restore; tag retirement/restore; rejection of an out-of-scope image without partial movement; anonymous RPC denial; and fixture cleanup preserving original IDs.
- The anonymous publishable-key call returned HTTP 401. Integration fixtures were two draft albums, two synthetic image records without uploaded objects, and one temporary tag. Cleanup removed only these newly created records. All 370 original image IDs, 15 original album IDs and 139 original catalog tag IDs remained.
- Final optimized bootstrap returned HTTP 200 with `ready = true`, 15 photographers, 15 albums, 370 images, 139 tags and zero assignments. It completed in about seven seconds on the tested connection. Both built asset URLs returned 200. A scan of browser API output and build files found neither configured Supabase server secret.
- Browser-based visual/interaction QA was unavailable: browser inventory was empty and opening Chrome through the supported UI tool returned unavailable. The responsive and keyboard behavior are implemented and code-reviewed, not browser-verified.
- Migration ping returned version 1 on the user-named project after the user applied the SQL. The earlier pasted SQL error did not imply the dataset tables were missing; the existing portfolio table remained readable.

The importer now creates/reuses a fresh intake revision if the curator archives the original inbox. Existing image identities, manual grouping and the archived album are preserved. This compatibility behavior is covered offline; it did not require modifying the applied migration or creating extra real demo albums during the final audit.

## Remaining review

Database reviewer approval and replay against a designated disposable Cloud project remain unperformed. Live fixture checks on the user-named project do not substitute for all main-product RLS role tests. The RPC grants no new access to anonymous/authenticated roles. No Site registration, cloud hosting, deployment, new dependency installation, Git commit or push was performed.

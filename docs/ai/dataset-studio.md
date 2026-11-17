# Local Dataset Studio

A separate curation website for the photographs collected by [the intake script](portfolio-dataset.md). It edits the existing Supabase dataset directly. It does not change the main application routes, start an embedding job, infer labels, or publish a hosted Site.

## Start

Run from the repository root with the existing Python requirements and installed workspace dependencies:

```powershell
py -3 scripts/dataset_studio.py
```

Open `http://127.0.0.1:8765`. The launcher builds the separate React entry point when its sources change, then serves its static files and local API from one loopback server. Subsequent unchanged launches reuse the build. Node.js and the existing Vite/React/Astryx dependencies are required; no new frontend package is installed by this tool. Python requirements are the same as the collector.

```powershell
# Another local port
py -3 scripts/dataset_studio.py --port 8770

# Read-only session
py -3 scripts/dataset_studio.py --read-only

# Compile without starting a server
py -3 scripts/dataset_studio.py --build-only
```

Stop with Ctrl+C. There is no cloud deployment or LAN bind. Supabase URL and server key are read from the root `.env` by the Python backend; they are not sent to the browser. The app is intended for a trusted user on the same computer.

## Migration

Run [202611160003_dataset_studio.sql](../../supabase/migrations/202611160003_dataset_studio.sql) after the existing intake and tag migrations. Paste the file's SQL text into the SQL Editor, not an error message or a Markdown code fence. The new migration adds:

- `photographers.dataset_sort_order` for the profile list.
- `portfolios.sort_order` for album ordering.
- The atomic `dataset_studio_apply` RPC, executable only by `service_role`.

No images, Auth users, tags, or existing RLS/Storage policies are deleted. Business IDs still come from existing database defaults. The RPC serializes curator writes inside a PostgreSQL transaction. It rejects image/profile/album operations outside photographers with a non-null `dataset_key`. Tags are a shared catalog and are intentionally editable through the trusted local tool.

If the RPC is absent, the web still displays the dataset with editing disabled and a migration banner. After running SQL, use the refresh button. The migration was applied to the user-named Cloud project during implementation; opening a different project still requires its own verified schema/migration.

## Curation workflow

1. Select a demo photographer in the sidebar. Its title, city and biography can be edited. Sidebar arrows persist photographer order.
2. Open the album list. Each `portfolios` row represents one photographer post, with its own title, description, genre, publication state and ordered photographs. An importer inbox is a temporary album until its images have been organized.
3. Create an album. Choose draft, published, or hidden. New album requests use an idempotency key so a repeated creation request returns the same album.
4. Open all images or an existing album. Select individual images or the full filtered selection, then move them to an album. Destination choices include other demo photographers. The move updates image references; Storage paths and image IDs remain stable.
5. Drag album/photo cards or use their Previous/Next buttons. Image ordering requires one complete active album with filters cleared. Its first active image supplies the album cover.
6. Open an image to edit its caption, tags and annotation state. A caption/tag/state save is atomic. Marking reviewed is an explicit human action, independent of adding tags.
7. Use the selection toolbar to add/remove tags or mark many images reviewed. Adding tags preserves unselected existing tags. Removing tags affects only the selected tag IDs. Bulk operations accept at most 500 images per request.
8. Use the tag library to search bilingual names/aliases, edit definitions, create tags or retire existing tags. Retiring a tag preserves old assignments. Retired assigned tags remain removable from the image editor or bulk-removal dialog.

Album descriptions keep line breaks. Image previews show the whole frame; album covers use a crop for presentation. Source hints are not automatically converted into reviewed tags. Custom tags live in Supabase; creating one does not rewrite the editable CSV. Regenerating the seed catalog preserves custom slugs.

## Deletion and recovery

The UI performs reversible archival, not permanent deletion:

| Item         | Archive operation                  | Recovery                                           |
| ------------ | ---------------------------------- | -------------------------------------------------- |
| Photographer | `is_hidden = true`                 | Show hidden profiles, then restore the profile     |
| Album        | `deleted_at` set and status hidden | Restore from Trash; restored album becomes a draft |
| Image        | `is_hidden = true`                 | Restore the image from Trash                       |
| Tag          | `is_active = false`                | Show retired tags and restore the tag              |

Archiving an album does not individually archive its child images. Restoring it reveals its active images again. Image/tag identities and associations are preserved. Storage objects are retained, and public URLs retain the pre-existing public-bucket behavior. The collector/importer respects existing image identities and does not undo manual regrouping, captions, labels or publication choices.

If an importer's temporary inbox has been archived, a later import creates or reuses an active replacement inbox for that photographer rather than restoring the archived album. Already imported images stay in their manually curated albums. An archived photographer retains its stable demo identity; use Show hidden profiles when curating that identity again. Future physical Storage cleanup must follow current image references rather than deleting everything under an old album-path prefix.

## Local API and security boundary

This is a tooling API, separate from the main application's `/v1` contract:

| Endpoint             | Behavior                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /api/health`    | Local server liveness                                                                             |
| `GET /api/bootstrap` | Demo profiles/albums/images, shared tags, scoped assignments and an in-memory local session nonce |
| `POST /api/action`   | Validated action/payload forwarded to the service-only transaction RPC                            |

The server accepts only `localhost`/`127.0.0.1` Host values for its bound port, checks mutation origins and a custom session header, and grants no CORS access. Invalid JSON and unsupported fields/actions return structured errors. Keys stay in the Python process; browser responses include public image URLs only. A per-thread Supabase session avoids sharing a Requests session between HTTP handlers.

The RPC supports profile edit/archive/order, album save/archive/order, image caption/tags/review save, bulk move/order/archive/review/tags, and tag save/archive. Image changes must belong to dataset-marked demo photographers; the server does not accept SQL or arbitrary table names. A failed multi-image request rolls back all of its changes. No direct ordinary browser token is granted the RPC permission.

Bootstrap uses embedded image-tag records with pagination, avoiding a separate read per image. Cache invalidation follows each successful action. The React client uses TanStack Query for loading/mutation state and Astryx Button/TextInput/theme components; custom layout and native dialogs support the image workspace. Product copy is in the dedicated [strings module](../../apps/web/src/dataset-studio/strings.ts).

## Verification and source

```powershell
py -3 -m unittest discover -s scripts -p test_dataset_studio.py -v
py -3 -m unittest discover -s scripts -p test_portfolio_dataset.py -v
node apps/web/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
```

The standalone entry is [dataset-studio.html](../../apps/web/dataset-studio.html), with [its own build config](../../apps/web/vite.dataset-studio.config.ts) and [Python local server](../../scripts/dataset_studio.py). Generated output is ignored under `.artifacts/dataset-studio/`. Main `index.html`, routes and API startup remain unchanged.

See [DATA-002](../../plans/tasks/DATA-002.md) for actual check results and browser verification limits. Live integration tests use disposable draft fixtures and clean up only the rows they create, preserving all original dataset IDs.

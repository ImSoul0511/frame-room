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

Apply [202611180001_dataset_studio_delete_images.sql](../../supabase/migrations/202611180001_dataset_studio_delete_images.sql) next to enable permanent image deletion. It adds a service-role-only RPC and deletes no data during installation. The deletion RPC uses the same transaction lock as other curator actions and only accepts images attached to demo photographers with a non-null `dataset_key`.

Apply [202611180002_dataset_studio_photo_sets.sql](../../supabase/migrations/202611180002_dataset_studio_photo_sets.sql) to create and allocate unassigned sets. Pending sets and their image membership are stored in service-role-only tables. Allocation creates a photographer portfolio and transfers the member images atomically, preserving the set ID, image IDs, labels and order.

The app displays a banner for missing migrations and enables each available operation. After applying a migration, use the refresh button to check availability.

## Curation workflow

1. Open **Bộ ảnh** to browse sets across the dataset, with filters for type, title and allocation. **Chưa phân bổ** shows sets waiting for a photographer. Use **Ảnh chưa phân bộ** to see loose photos pooled across temporary importer inboxes.
2. Filter **Tất cả ảnh** or **Ảnh chưa phân bộ** by type or tag. A photo uses its assigned type tags when available. Otherwise, the filter uses the curated set's type or the import hint for inbox photos.
3. Select related images and use **Gom thành bộ mới**. Name the set and choose its type. The new set and its membership are saved together. You can also move selected photos into an existing set. While a set is unassigned, its membership is visible only in Dataset Studio.
4. Open a finished set and use **Phân bổ bộ ảnh** to choose an existing demo photographer. The set becomes a draft portfolio under that photographer. A photographer can receive sets of any type. Use **Đổi photographer** to transfer an assigned set.
5. Drag cards or use their Previous/Next buttons. Set ordering is available with a single photographer selected and other album filters cleared. Photo ordering requires one complete set with filters cleared. Its first active photo supplies the cover.
6. Open a photo to edit its caption, tags and annotation state. Search tags by name or alias, or browse one category at a time. Marking reviewed is an explicit action independent of adding tags.
7. Use the selection toolbar to add/remove tags or mark many images reviewed. Adding tags preserves unselected existing tags. Removing tags affects only the selected tag IDs. Bulk operations accept at most 500 images per request.
8. Use the tag library to search bilingual names/aliases, edit definitions, create tags or retire existing tags. Retired assigned tags remain removable from the image editor or bulk-removal dialog. The curator catalog excludes source tags.
9. Open **Photographer** and select a profile to see its assigned sets and edit its name, city and biography. Use **Chọn bộ ảnh để gán** to select one or more unassigned sets with photos. Successful assignments appear in the profile as each set is saved.

Set descriptions keep line breaks. Image previews show the whole frame, and set covers use a crop. Import source hints remain provenance metadata. Custom tags live in Supabase, and regenerating the seed catalog preserves custom slugs.

## Deletion and recovery

The photo editor, selection toolbar and Trash offer **Xóa vĩnh viễn**. Confirming it deletes the selected `portfolio_images` rows, their tag assignments and embeddings in one database transaction. If any requested ID is missing or out of scope, the request rolls back. The Storage objects and local crawl files are retained, so a later import of the same files can create new image records.

Reversible archival is also available:

| Item         | Archive operation                  | Recovery                                           |
| ------------ | ---------------------------------- | -------------------------------------------------- |
| Photographer | `is_hidden = true`                 | Show hidden profiles, then restore the profile     |
| Album        | `deleted_at` set and status hidden | Restore from Trash; restored album becomes a draft |
| Image        | `is_hidden = true`                 | Restore the image from Trash                       |
| Tag          | `is_active = false`                | Show retired tags and restore the tag              |

Archiving an album hides its active child images until the album is restored. The importer respects existing image identities and preserves manual regrouping, captions, labels and publication choices.

If an importer's temporary inbox has been archived, a later import creates or reuses an active replacement inbox for that photographer rather than restoring the archived album. Already imported images stay in their manually curated albums. An archived photographer retains its stable demo identity; use Show hidden profiles when curating that identity again. Future physical Storage cleanup must follow current image references rather than deleting everything under an old album-path prefix.

## Local API and security boundary

This is a tooling API, separate from the main application's `/v1` contract:

| Endpoint             | Behavior                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /api/health`    | Local server liveness                                                                             |
| `GET /api/bootstrap` | Demo profiles/albums/images, shared tags, scoped assignments and an in-memory local session nonce |
| `POST /api/action`   | Validated action/payload forwarded to the service-only transaction RPC                            |

The server accepts only `localhost`/`127.0.0.1` Host values for its bound port, checks mutation origins and a custom session header, and grants no CORS access. Invalid JSON and unsupported fields/actions return structured errors. Keys stay in the Python process; browser responses include public image URLs only. A per-thread Supabase session avoids sharing a Requests session between HTTP handlers.

The local API forwards profile, assigned album and tag edits to `dataset_studio_apply`. Set creation, allocation, membership changes and ordering use `dataset_studio_sets_apply`. The `images.delete` action takes 1 to 500 distinct photo IDs and uses `dataset_studio_delete_images`. Image changes are restricted to dataset-marked demo photographers. A failed multi-image request rolls back all of its changes. Only the service role can execute these RPCs.

Bootstrap reads the catalog and supported actions alongside the paginated images. The client updates saved photo fields, edited profiles and sets, assignments and deletions from confirmed mutations. Other actions refresh the dataset when they need generated data or additional state. The React client uses TanStack Query and Astryx Button/TextInput/theme components. Product copy is in the dedicated [strings module](../../apps/web/src/dataset-studio/strings.ts).

## Verification and source

```powershell
py -3 -m unittest discover -s scripts -p test_dataset_studio.py -v
py -3 -m unittest discover -s scripts -p test_portfolio_dataset.py -v
node apps/web/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
```

The standalone entry is [dataset-studio.html](../../apps/web/dataset-studio.html), with [its own build config](../../apps/web/vite.dataset-studio.config.ts) and [Python local server](../../scripts/dataset_studio.py). Generated output is ignored under `.artifacts/dataset-studio/`. Main `index.html`, routes and API startup remain unchanged.

See [DATA-002](../../plans/tasks/DATA-002.md) for actual check results and browser verification limits. Live integration tests use disposable draft fixtures and clean up only the rows they create, preserving all original dataset IDs.

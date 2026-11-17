# Demo photograph intake and manual labeling

The collector downloads loose photographs by suggested genre. It deliberately does not infer albums, authorship, aesthetic tags, embeddings, or image similarity. Imported photographs are randomly assigned to synthetic photographers in the same suggested genre. This is demo data rather than a benchmark of photographer ability.

Use the separate [local Dataset Studio](dataset-studio.md) to organize imported images into photographer albums, edit descriptions, and apply manual tags after collection.

## Install on Windows

Run from the repository root. The Windows Python launcher is `py`; a bare `python` command may be unavailable.

```powershell
py -3 -m venv .artifacts/dataset-venv
.artifacts/dataset-venv/Scripts/python.exe -m pip install -r scripts/requirements-portfolio-dataset.txt
```

Commands below use `py -3` for an interpreter with the requirements already installed. If using the isolated environment, replace it with `.artifacts/dataset-venv/Scripts/python.exe`.

## Apply the new SQL files in order

The user has already applied `portfolio_dataset_setup.sql`. Do not rerun or edit that migration for this workflow. Run these new files in the intended Supabase project's SQL Editor:

1. [202611160001_demo_image_intake.sql](../../supabase/migrations/202611160001_demo_image_intake.sql): adds stable demo identity/import keys, checksums, suggested genre, annotation status, and tag retirement support.
2. [202611160002_demo_tag_catalog.sql](../../supabase/migrations/202611160002_demo_tag_catalog.sql): upserts the revised 136-tag bilingual catalog. Existing tag IDs, image-tag assignments, and custom tag slugs remain. Seeded names, definitions, categories and aliases are refreshed; existing `is_active` choices remain.

Neither file drops columns, deletes images, creates vectors, changes table RLS policies, or changes bucket access. Database replay and permission tests still need a designated disposable Cloud project. These SQL Editor artifacts depend on the pre-existing business schema; they do not bootstrap an empty database through `supabase db reset`.

Keep the target URL and secret in the root `.env`:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET
```

The importer also accepts the legacy `SUPABASE_SERVICE_ROLE_KEY`. The publishable/public key is not required by this server-side tool. It never adds credentials to source-image requests. Process environment variables take precedence over `.env`; within the file the last duplicate definition wins.

```powershell
py -3 scripts/portfolio_dataset.py doctor
```

`doctor` performs only reads: schema column access, bucket inspection, and Auth Admin read access. It does not prove client RLS correctness. If a migration is missing, a REST column check fails before importing anything.

## Collect images locally

Edit [crawl-sources.json](../../data/crawl-sources.json). Each job contains a source adapter, a suggested genre, and either public URLs or Pinterest search queries. The eight application genres are supported. Graduation is a subject tag and appears in portrait/event search queries rather than a new application enum.

Use `--source mywed`, `--source pinterest`, or `--source potonow` to run only one website. Omitting `--source` runs every enabled job matching the selected genres. `--source` does not enable a disabled job.

```powershell
py -3 scripts/portfolio_dataset.py crawl --genres wedding --per-genre 50
py -3 scripts/portfolio_dataset.py crawl --genres portrait,fashion --per-genre 100 --browser --headed
```

`--per-genre` is a target TOTAL per genre in the local manifest, including previous runs. `--max-pages` limits pages per job. Add more public feed URLs or queries to expand coverage. There is no invented pagination API: only pagination/profile links present in the page are followed. MyWed currently supplies 40 content images per inspected feed; a short run may exhaust one page. Potonow profile pages contain mixed-genre work, so their example job is disabled until you opt into that ambiguity or select suitable profiles yourself.

The collector reports actual totals and exits with code 2 when any requested genre is below its target. A page with no Pinterest pins is reported explicitly. A successful HTML response alone never counts as collected photographs.

Files are written below `.artifacts/portfolio-dataset/`:

- `images/`: oriented JPEGs with both dimensions at most 1280 pixels; EXIF is discarded.
- `manifest.jsonl`: one successfully downloaded record per unique normalized image, including the weak genre hint and local checksum.

Local files share one flat `images` directory and are named `<SHA256>.jpg`, not grouped into source/genre folders. The manifest records the source, suggested genre, query, source URLs, dimensions, checksum and download time. `crawl` never uploads to Supabase. Only `import --apply` uploads the normalized JPEG to `portfolio-images/<portfolio-id>/intake/<SHA256>.jpg` and inserts its `portfolio_images` record. Local files remain after import.

### Run one website at a time

MyWed wedding feeds, with no browser requirement:

```powershell
py -3 scripts/portfolio_dataset.py crawl --source mywed --genres wedding --per-genre 100
```

Pinterest search, using the browser profile prepared by `browser-login`:

```powershell
py -3 scripts/portfolio_dataset.py crawl --source pinterest --genres portrait,fashion,product,food --per-genre 100 --browser --headed
```

For Potonow, first change its example job from `"enabled": false` to `"enabled": true` in the source config, and replace its `urls` with suitable profile URLs or keep the photographer listing. Then run:

```powershell
py -3 scripts/portfolio_dataset.py crawl --source potonow --genres portrait --per-genre 100 --max-pages 8
```

Potonow profile feeds can contain mixed genres; `portrait` remains an intake hint rather than a reviewed label. Facebook has no adapter in this version.

All three commands above share the default output directory. `--per-genre` counts the total local images of that genre across sources in that directory, not the number newly downloaded from the selected website. To add 50 Pinterest wedding images after already collecting 100 wedding images from MyWed, set `--source pinterest --genres wedding --per-genre 150`.

To keep local collections separate by website, use a distinct `--output`, and pass the same directory to import:

```powershell
py -3 scripts/portfolio_dataset.py crawl --source pinterest --genres portrait --per-genre 50 --browser --headed --output .artifacts/pinterest
py -3 scripts/portfolio_dataset.py import --output .artifacts/pinterest --publish --apply
```

Separate directories have independent crawl totals and local duplicate detection. Database duplicate detection still applies across collections. Do not run multiple collectors against the same output directory concurrently.

The collector rejects tiny thumbnails, invalid image bodies, animated images, and responses larger than 20 MiB. MyWed's inspected Google-hosted cropped thumbnails are requested at an uncropped bounded size. Pinterest uses the largest variant actually advertised in the DOM/embedded data. Exact normalized pixel duplicates are skipped; re-encoded, cropped, or visually similar images can still remain for later manual review. The original download is not retained.

Run one collector per output directory at a time. Completed records survive interruption. A failed image can be retried on the next run. If you manually remove or modify cached files, repair/remove the corresponding manifest records before resuming; the importer checks file hashes. A malformed final manifest line is reported rather than silently discarded.

### Pinterest rendering and manual sign-in

The logged-out search HTML inspected in this session contained no pins. Browser rendering is optional and requires a separate dependency:

```powershell
py -3 -m pip install -r scripts/requirements-portfolio-browser.txt
py -3 -m playwright install chromium
py -3 scripts/portfolio_dataset.py browser-login
py -3 scripts/portfolio_dataset.py crawl --genres portrait,fashion,product,food --per-genre 50 --browser --headed
```

Sign in yourself if Pinterest requests it, then press Enter in the terminal. This saves a separate local browser profile under ignored `.artifacts/portfolio-browser/`; it does not reuse your personal browser profile or export cookies into manifests. Login/access challenges must be handled normally. The script does not solve challenges, bypass access controls, or guarantee Pinterest availability. The optional browser adapter has offline extraction tests but has not been tested with a real signed-in Pinterest session here. Facebook album support is deferred.

## Preview and import

```powershell
py -3 scripts/portfolio_dataset.py import --photographers-per-genre 3
py -3 scripts/portfolio_dataset.py import --photographers-per-genre 3 --publish --apply
```

Without `--apply`, this checks local files and prints assignments without loading keys or connecting to Supabase. With `--apply`, it creates only the photographer slots receiving images, through Auth Admin users, profiles, photographers and temporary inbox portfolios. It uploads JPEGs to the existing `portfolio-images` bucket and inserts `portfolio_images` rows. No email invitation is sent; account passwords are random and are not printed or stored in the manifest. These are synthetic identities, not replicas of source photographers. No services/bookings are created in this phase.

Assignment uses the image fingerprint, suggested genre, photographer count and seed. It behaves randomly while remaining repeatable across retries. Keep `--namespace`, `--seed` and `--photographers-per-genre` stable for a dataset. `--limit 10` supports a small first import. `--genres wedding,portrait` restricts which cached records are imported.

New inboxes are drafts by default. `--publish` publishes only newly created inboxes; it does not republish an existing draft or override a human's publication decision. Published inboxes have a publication timestamp and visible synthetic photographers. Website display still depends on application query/UI implementation. All Storage objects in the existing public portfolio bucket are directly readable regardless of portfolio publication status.

Each image has `label_status = 'unlabeled'`, a `suggested_genre` hint and an empty caption. No `image_tags` or `image_embeddings` rows are written. The original URL/title remain in the local manifest for troubleshooting; no author or source album is used to assign photographers or group images.

An inbox is a temporary existing `portfolios` record identified by a dataset key ending in `:inbox`, not a claimed photo session. A later labeling UI can create real curated portfolios and move image rows into them. The importer skips image keys already present anywhere and preserves manual captions, tags, annotation states, and regrouping.

After an inbox is archived through Dataset Studio, new imports use an active replacement with a `:inbox:rev:NNN` dataset-key suffix. The original album remains archived and existing images remain in their manually selected albums. Retrying an incomplete import reuses the replacement instead of creating another album.

Auth, Storage and REST inserts are separate operations. A failed import stops and returns nonzero; rerunning recovers existing users/providers/inboxes and retries stable object paths. A crash after an upload may leave an unreferenced object until the next run completes. Do not delete imported Auth users manually while a run is in progress. Concurrent imports can encounter uniqueness conflicts; run one importer at a time and rerun after a failure. No database-wide rollback or destructive cleanup is attempted.

### Network recovery during import

Supabase requests reuse a persistent connection pool. Resume checks use bounded batches of image keys/checksums instead of one or two reads for every cached image. The importer reports the existing/pending counts before writing anything new.

Reads and stable-path Storage upserts automatically try up to four times on connection/timeouts or HTTP 429/500/502/503/504, with bounded backoff. Auth user creation and ordinary row inserts are not blindly replayed after an uncertain response, because the server may already have committed the write. Rerunning the complete import discovers those existing identities/images safely.

Image uploads allow 60 seconds for socket operations while sending the body and 60 seconds while reading the response. Ordinary reads retain a 15-second connect timeout and 60-second read timeout. Requests can report a slow upload as `ConnectionError` wrapping a write `TimeoutError`; the diagnostic labels known upload write timeouts explicitly. A short connection timeout can otherwise interrupt a large upload even when preflight reads succeed.

Image uploads use four workers by default. Each worker owns a separate HTTP session; account and inbox preparation remains sequential. Use `--workers 1` for sequential uploads or `--workers 6` for a larger bounded upload pool. On an unrecovered error, queued work is cancelled and in-flight writes finish before the command returns. Successful rows remain available for the next resume; there is no all-or-nothing rollback across images.

Errors identify the method, endpoint and exception class without printing raw exceptions, keys, proxy URLs or request bodies. A passed preflight establishes that its initial checks worked; it does not guarantee that later network calls cannot fail. If retries still fail, retain the detailed error and rerun the same command after restoring connectivity; no SQL migration or dataset reset is needed.

## Edit the tag catalog

[photography-tags.csv](../../data/photography-tags.csv) is the editable sample catalog with slug, English/Vietnamese name, category, definitions, and pipe-separated aliases. It separates muted color from matte rendering, emotional mood from brightness, and glam from slay. It retains the existing coarse `tag_kind` through a compatibility mapping. Detailed labeling should use `category` and the definitions.

Use `tags.is_active = false` to retire an existing tag while preserving assignments. A future labeling UI may create custom tags with unique slugs and appropriate category/kind; this task does not grant new client write permissions. Reviewed image labels belong in the existing `image_tags` relation, with `source = 'manual'`. Mark an image reviewed even if no aesthetic labels apply. Search-query words are never automatically confirmed tags. The supplied SQL refreshes overlapping catalog slugs but does not remove custom slugs.

After editing the CSV, generate a NEW migration filename if a previous catalog migration has already been applied:

```powershell
py -3 scripts/portfolio_dataset.py tags-sql --output supabase/migrations/202611160004_demo_tag_catalog_update.sql
```

Do not regenerate a migration already applied to Cloud. Changing a tag definition does not automatically revalidate prior human assignments. Ambiguous words such as fresh and slay require judgment; the catalog provides a shared definition rather than a claim of objective ground truth.

## Verification

```powershell
py -3 -m unittest discover -s scripts -p test_portfolio_dataset.py -v
```

Offline checks cover source-specific extraction, empty Pinterest pages, image orientation/resize, metadata-only duplicate suppression, manifest path/hash validation, deterministic assignment, interrupted upload recovery, and preservation of manual changes. They use a fake Supabase transport; they do not replace Cloud Auth/Storage/trigger/RLS tests. See [DATA-001](../../plans/tasks/DATA-001.md) for evidence and remaining checks.

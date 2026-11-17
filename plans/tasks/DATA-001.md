# DATA-001: Loose photograph intake and manual tag catalog

Status: In Review
Branch: crawler (existing user working branch; unrelated changes preserved)
Jira: Not linked

## Authorized decisions

- The user confirms `portfolio_dataset_setup.sql` has already run. Add subsequent migrations; preserve the applied file.
- Prioritize loose images by suggested genre. Randomly distribute them to synthetic demo photographers; infer neither original authors nor photo sessions.
- Prepare manual labeling and later manual album organization using the supplied extensible tag catalog.
- Defer Facebook albums, embeddings, similarity algorithms, and the labeling website.

## Deliverables

- [Collector/importer](../../scripts/portfolio_dataset.py), [requirements](../../scripts/requirements-portfolio-dataset.txt), and optional [browser requirements](../../scripts/requirements-portfolio-browser.txt).
- [Source jobs](../../data/crawl-sources.json) and [136-tag bilingual CSV](../../data/photography-tags.csv).
- Additive [intake migration](../../supabase/migrations/202611160001_demo_image_intake.sql) and generated [catalog migration](../../supabase/migrations/202611160002_demo_tag_catalog.sql).
- [Usage and recovery guide](../../docs/ai/portfolio-dataset.md) and [offline checks](../../scripts/test_portfolio_dataset.py).

## Schema, access and failure boundaries

The existing portfolio/tag business contract is retained. New fields provide importer identities, checksums and manual annotation state. No new public table, policy, role, Storage exposure or business endpoint is created. The taxonomy retains `tag_kind` compatibility and adds no enum values. Gallery and booking tables are untouched.

| Actor / action                                            | Expected result                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Anonymous visitor / published portfolio read              | Existing table/Storage policies apply; no additional grant              |
| Photographer / own portfolio or tags                      | Existing policies apply; no new client write permission                 |
| Another user / editing someone else's image or annotation | Must remain denied by the existing policies                             |
| Forged user ID or metadata role / privileged import       | Must not grant Auth Admin or server-secret access                       |
| Local importer / authorized project with server secret    | May create synthetic users, profiles, photographers, inboxes and images |

Auth creation, profile/provider initialization, object upload and image insertion are recoverable separate operations. The importer stops on an incomplete write; reruns discover stable identities and objects. Existing human labels/publication/regrouping are never overwritten. Duplicate keys and checksums enforce uniqueness; concurrent runs may stop with a conflict and require a rerun. Migration statements are transactional, with no data deletion. Rollback after import should retain additive columns to avoid dropping labels or identities.

## Verification evidence

- Public HTTP probes: MyWed editors feed returned 200 with 40 extracted content images; inspected Potonow profile returned 200 with 30 extracted gallery images. Pinterest logged-out search returned 200 with no extractable pins. MyWed detail returned 418, so the adapter uses the publicly advertised content image with a bounded uncropped transform.
- Read-only Supabase OpenAPI request to the user-named project confirmed photographer/studio ownership values, eight genres, draft/published/hidden portfolio states, and captured/manipulated/ai_generated provenance. New intake columns were absent. No Cloud data writes or SQL execution were performed.
- Optional signed-in browser extraction: not run; no browser surface was available in the companion session.
- Git fetch could not update read-only `.git/FETCH_HEAD`; local refs are not claimed current. No branch switch, commit or push was performed.
- Offline verification passed: 19 tests using `py -3 -m unittest discover -s scripts -p test_portfolio_dataset.py -v`. Import/transport tests use isolated fakes and no real project mutations.
- Live smoke collection passed: 3 wedding images from MyWed and 3 portrait/graduation images from the inspected Potonow profile, saved under ignored `.artifacts/portfolio-smoke`. Dimensions were 853x1280, 1280x854, or 1280x853; EXIF was absent. A contact sheet was visually inspected. Import preview passed without loading credentials. This small sample does not establish eight-genre coverage or signed-in Pinterest reliability.
- Python compilation and the scoped Prettier check passed. `node scripts/check-docs.mjs` passed for 70 Markdown files. The `pnpm docs:check` wrapper refused the host's Node 24.11.1 because the project requires Node 22; direct execution of its unchanged checker passed. The full application check suite was not run for this standalone Python/data change.

## Remaining Cloud checks

Replay the exact two new SQL artifacts on a designated disposable Cloud test project. Verify existing owner/other-user/anonymous database access and forged-identity denials with ordinary tokens, not only the server secret. Real Auth/profile initialization, Storage downloads and publication state were confirmed in the user-run import below; same-image reruns and interruption recovery remain verified offline only. Generate database types with a reviewed Cloud-targeting command after schema verification; the historical `db:types` command targets local Supabase and was not used. Ly/Khai database review remains pending. No disposable Cloud project was designated in this session.

## Follow-up verification after the user-run import

The user's terminal log reported 50 downloaded and imported wedding images. A subsequent read-only audit of the same named Cloud project confirmed:

- All 50 local manifest entries have existing JPEG files with matching checksums and dimensions, at most 1280 pixels on each side, and no EXIF. There are 50 distinct normalized file checksums and pixel fingerprints.
- All 50 image keys exist in `portfolio_images`, with matching checksums, dimensions and suggested genre. There are no missing records, hidden images, or mismatched fields. All annotation states are `unlabeled`.
- Demo Wedding 01 has 12 images, Demo Wedding 02 has 14, and Demo Wedding 03 has 24. Their three inbox portfolios are published, have publication timestamps, and are not deleted. Photographers are visible.
- The three linked profiles and Auth users exist. Auth email confirmation and importer dataset markers match for all three synthetic identities. No user contact details or credentials were included in audit output.
- All 136 catalog tags exist and are active; their names, categories, bilingual definitions and aliases match the CSV.
- All 50 public Storage URLs returned HTTP 200 without authentication. Every downloaded object checksum matches its image row and local file.
- The 50 imported images have zero `image_tags` assignments and zero `image_embeddings` records, as intended for manual labeling later.
- A numbered contact sheet of all 50 images was visually inspected. It contains wedding/bridal imagery and wedding-event coverage; this is a coarse review, not manual tag approval or album grouping.

The audit only issued reads. Its script, aggregate JSON report and contact sheet remain under ignored `.artifacts/`. No migration, import rerun, or Cloud data mutation was performed during this follow-up. The successful wedding import does not establish coverage of the other seven genres or signed-in Pinterest reliability.

## Import connection recovery fix

The user subsequently collected 370 local images and reported repeated generic connection failures during import. A read-only diagnosis found 124 already imported images (50 wedding and 74 portrait), six synthetic photographers, and working REST/Auth reads at diagnosis time. The original generic log did not identify which endpoint had failed.

The transport now reuses a dedicated Requests session, retries reads and stable-path Storage upserts up to four times with bounded backoff, and reports method/endpoint/exception class without raw exception bodies or credentials. Non-idempotent Auth/row creation is not automatically replayed after uncertain network outcomes. Resume lookup uses batches of at most 50 identifiers/checksums and prints existing/pending totals, eliminating a separate connection/read for every old image.

Offline verification passed: 28 tests, including transient read failures, safe Storage retry, no blind Auth-create retry, retry exhaustion, bounded rate-limit waits, batched identity lookup, separate clients for bounded parallel uploads, and redacted upload-timeout diagnostics. Python compilation, scoped Markdown formatting and the documentation checker also passed. No schema migration was changed.

A real resumed import identified 124 existing and 246 pending images. It encountered Storage upload `ConnectionError` failures and recovered most through retries. The slow sequential verification run was interrupted after preserving its completed rows, then resumed with six upload workers, each using its own session. The default is four workers; accounts and inboxes are prepared sequentially. On an unrecovered error queued work is cancelled, in-flight writes finish, and completed image rows remain available for resumption.

The parallel run skipped 151 existing rows and inserted 218, leaving one 469186-byte food JPEG. A focused diagnostic showed `ConnectionError -> ProtocolError -> TimeoutError`. Raising the upload socket/connect timeout from 15 to 60 seconds allowed the final file to succeed; the last run skipped 369 existing rows and inserted one. Uploads now use `(60, 60)` timeouts while ordinary reads retain `(15, 60)`. No local image re-encoding or schema/data reset was needed.

The final read-only audit confirmed 370 images across 15 photographers: 80 each for portrait, fashion, product and food, plus 50 wedding images. All 370 database keys, checksum fields and dimensions matched the local manifest, all images were unhidden and unlabeled, and all 15 portfolios were published. Public Storage samples from every genre returned matching content. A final repeat of `import --publish --apply` reported `370 already imported; 0 pending` and completed with no new writes. Aggregate audit output remains in ignored `.artifacts/portfolio-resume-verification.json`.

## Website-specific command follow-up

Added `crawl --source mywed|pinterest|potonow` after the user asked for per-website commands. Source selection intersects with genre selection and preserves disabled job settings; no enabled matching job produces an actionable error. The guide now documents local image/manifest storage, the separate Supabase import step, source-specific examples, cumulative genre targets across sources and independent `--output` directories. Offline verification passed 30 tests, including website/genre isolation and disabled-job preservation; compilation, CLI help, scoped Markdown formatting and documentation checks passed. No crawl, Cloud import or migration was run for this CLI/documentation change.

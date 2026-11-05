# Storage configuration

Confirmed MVP source: `supabase/migrations/20261030000200_mvp_workflows.sql`, `apps/api/src/services/media.ts`, `docs/api/mvp.md` on the feature branch.

| Bucket                                                                 | Public | Limit      | MIME            |
| ---------------------------------------------------------------------- | ------ | ---------- | --------------- |
| `avatars`, `profile-covers`, `portfolio-images`                        | Yes    | 2 MiB each | WebP            |
| `gallery-previews`, `brief-references`, `room-files`, `search-uploads` | No     | 2 MiB each | WebP            |
| `ai-artifacts`                                                         | No     | 5 MiB      | WebP            |
| `deliveries`                                                           | No     | 20 MiB     | JPEG, PNG, WebP |

The API validates uploaded bytes and creates normalized images and paired thumbnails. The initial SQL permits authenticated direct inserts only for owner-prefixed public/profile/reference/search paths; gallery, room, delivery and generated assets are API-only writes. `private.storage_read` controls private reads; API signs private URLs for five minutes. Published portfolio URLs are public even if later hidden through the API. Do not store sensitive or unlicensed content there. Reassignment can stop new reads but cannot revoke an already issued signed URL before expiry.

Cloud setup must create buckets and policies before media flows, configure the server-only service role key, verify object key conventions used in `media.ts`, and test cross-account read/insert denial. Storage files themselves are not contained in a Git archive or SQL migration.

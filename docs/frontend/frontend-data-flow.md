# Frontend data flow

The [router](../../apps/web/src/App.tsx) loads page modules on navigation. Home loads fixed WebP assets and reuses the browser cache. Explore queries the catalog by photographer, genre, location or tag. It requests more results as the visitor reaches the end of the current page.

Supabase Auth maintains the session. The [API client](../../apps/web/src/lib/api.ts) sends the bearer token and selected language with requests. TanStack Query caches reads by path and account and clears private data when the account changes. Avatar updates refresh profile, discovery and conversation data.

Account settings allow direct editing of display name and username. The shared profile schema validates and normalizes input before `PATCH /v1/me`. Save is enabled only for changed values; Cancel restores the last saved values. Pending submissions disable the form, and profile caches and the saved message update only after a successful response. Duplicate usernames have a field error; other failures retain the draft for retry. The sign-in email appears separately as labeled account information.

Avatar and cover edit buttons share a dropdown with View and Choose photo actions. View is disabled when no image exists. Choosing an avatar opens its crop editor; choosing a cover opens its preview after file selection. The same cover dropdown is used on client and photographer profiles, including the photographer's portfolio cover fallback.

Own client and photographer profiles place the cover in a full-width banner above the avatar and identity row at every viewport size. The avatar and name remain below the banner without overlapping the cover.

Uploads use multipart `POST /v1/uploads` and register the returned Storage path with the relevant catalog, project or booking endpoint. Private downloads require authorized access and expiring URLs. See the [storage guide](../database/storage-configuration.md).

The chat launcher and full inbox share message state. Direct conversations and shoot rooms use separate scopes. Expanding a conversation preserves its draft. The [route inventory](feature-inventory.md) lists each workflow.

# Supabase Cloud

Run the web app, API and optional completion worker against one Supabase Cloud
project. The web app uses Supabase Auth and Realtime. The API verifies the
session with Supabase Auth, runs business transactions in PostgreSQL, and manages
uploads in the project's Storage.

## Configuration

Use Node.js 22 and pnpm 9.15.0. Set the ignored root `.env` using
[.env.example](../../.env.example).

| Setting                                         | Purpose                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`, `VITE_SUPABASE_URL`             | The same project URL on the server and browser                                                        |
| `SUPABASE_PUBLIC_KEY`, `VITE_SUPABASE_ANON_KEY` | Project publishable or anonymous key                                                                  |
| `SUPABASE_SECRET_KEY`                           | Secret or service-role key for server-side Storage and REST operations                                |
| `DATABASE_URL`                                  | Server-only PostgreSQL connection for the same project. Use the Cloud session pooler for IPv4 access. |
| `VITE_API_URL`, `API_PUBLIC_ORIGIN`             | Browser-visible API origin. The second setting defaults to the first.                                 |
| `WEB_ORIGIN`                                    | Frontend origin allowed by the API                                                                    |
| `AI_SEARCH_ENABLED`                             | Keep `false` for UC-001 verification                                                                  |

The API also accepts the legacy `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` names. Restart the API and web after editing settings.
Keep email confirmation enabled and allow the application origin and callback
paths in Supabase Auth. Development commonly uses
`http://localhost:5173/**`. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm dev:worker` in a second terminal to process due booking completions.
Completion works with AI Search disabled and without an AI Gateway key. The
REST adapter handles discovery and own-account operations when `DATABASE_URL`
is absent. Booking, Studio management, reporting and other transactional
operations use the PostgreSQL connection.

## Account workflow and demo

Account navigation opens persistent routes for profile, Studio, portfolio,
projects, bookings, messages, notifications and moderation. A public provider
page uses published packages for booking and returns visitors to their intended
action after login. FrameRoom Atelier keeps primary routes exclusively API-backed.
The in-memory role simulator is isolated at `/sandbox` in development and is not
included in primary navigation. Legacy `/bookings/live` URLs redirect to canonical
booking routes.

After the private portfolio bucket migration, new catalog responses point to
`/v1/portfolio-media`. Existing direct Supabase public Storage URLs for that
bucket must be refreshed. Authenticated owners can preview staged images with
short-lived URLs in the portfolio editor.

## Verification

Replay the ordered migrations on a designated disposable Cloud project before
changing a shared database. Review the migration list with the PostgreSQL
connection for that project and apply the reviewed set.
[Migration workflow](migration-workflow.md)

Set `CLOUD_TEST_DATABASE_URL` and `CLOUD_TEST_PROJECT_REF` before running
`pnpm test:db`. The second value must match the tested Cloud connection.
The database suite uses synthetic records, rollback and targeted fixture cleanup.
Its concurrency scenario expects the fixture profiles `demo_client`,
`demo_minh`, `demo_linh` and the `Still Studio` package.

The Playwright private journey uses the same disposable database configured as
`DATABASE_URL` and the same Cloud project configured in the browser. Set
`FRAME_ROOM_E2E_CLIENT_EMAIL`, `FRAME_ROOM_E2E_MANAGER_EMAIL`,
`FRAME_ROOM_E2E_OUTSIDER_EMAIL` and `FRAME_ROOM_E2E_PASSWORD` for synthetic
accounts. The fixture Studio needs a published package, an eligible Photographer
named Linh Nguyen and an active Daylight room resource. Use Chromium or set
`FRAME_ROOM_E2E_CHANNEL=msedge` for an installed Microsoft Edge.

```powershell
pnpm test:db
pnpm test:e2e
pnpm db:types:cloud
```

Cloud type generation requires Supabase CLI authentication with access to
`CLOUD_TEST_PROJECT_REF`. Generate types after the migration replay and database
checks succeed.

# Supabase Cloud discovery and account preview

The discovery and authentication screens can use the existing Supabase Cloud project
without a direct PostgreSQL connection. The API selects this adapter only when
`DATABASE_URL` is absent. Existing PostgreSQL routes continue to use the original
repository implementation when that setting is present.

## Configuration

Use Node.js 22 and the repository's pinned pnpm version. Configure the ignored root
`.env`, then start the application with `pnpm dev`.

| Setting                                              | Purpose                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `SUPABASE_URL`                                       | Cloud project URL used by the API                               |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLIC_KEY`         | Public key used for Auth verification and public catalog reads  |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` | Server-only credential for authenticated own-account operations |
| `VITE_SUPABASE_URL`                                  | Same Cloud project URL for the browser                          |
| `VITE_SUPABASE_ANON_KEY`                             | Same public key for the browser; never a privileged key         |
| `VITE_API_URL`                                       | Local API origin, normally `http://localhost:4000`              |

The standard API key names take precedence over their aliases. Restart the API and
web server after environment changes. A local browser URL must not be combined with
unrelated local Supabase keys when the intended database is Cloud.

Supabase email confirmation remains enabled. In Supabase Authentication URL
Configuration, allow the application origin and its callback/recovery paths. For
local development, the redirect allowlist can include `http://localhost:5173/**`.
Hosted deployments need their own precise origins. The application uses
`/auth/callback?next=...` for confirmation and `/reset-password` for recovery.
See [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
and [password authentication](https://supabase.com/docs/guides/auth/passwords).

## Implemented scope

- Public provider discovery, genre/location/budget filters and card sorting.
- Public taxonomy tags, including optional Vietnamese labels and categories.
- Provider detail with publicly visible portfolios, services and reviews.
- Public portfolio galleries and image previews, retaining published/visible filters.
- Separate display-name/username search using public profile fields only.
- Supabase password login, signup, confirmation/resend and recovery forms.
- Verified own-profile read/create/update and own-photographer onboarding.

Catalog reads use the public credential and existing RLS. Draft portfolios and
hidden images are not made public. When no public cover exists, cards show initials
and the explicit no-public-images label. Account endpoints verify the Supabase
identity and confirmed email before account access; writes use that identity rather
than IDs or roles supplied in form data. Registration metadata only prefills the
onboarding form. Roles are derived from database records.

An interrupted profile creation can be retried with the existing Auth identity.
An existing own profile is returned without renaming it on repeated creation.
New users complete their account profile after email confirmation; photographer
users additionally create their photographer record. The intended local destination
survives authentication and onboarding. Callback errors and backend failures have
visible recovery states.

Live business services still require their documented PostgreSQL and AI
configuration. The current operational UI uses a frontend-only demo described below.
The runtime does not automatically publish portfolios or change
database policies. On 2026-11-19, a separate user-authorized data operation published
25 existing photographer portfolios containing 752 images; deleted portfolios were
excluded. Public API verification returned 24 profiles with covers and all 752 images.

## Profile layouts

The account overview is available at `/profile`; editing remains at `/settings`.
These operational layouts now use the selected local demo actor and save changes
only in memory. The account does not display an AI usage panel or request usage data.
Existing real provider and portfolio URLs continue to read public data.

Standalone sample profiles and their navigation entry remain removed. Where a public
provider has no service package, its page offers an explicitly named **Demo package**
so the mock booking form can be reviewed. No fake package is written to the database.

## Frontend workflow demo

The header's **Demo session / View as** selector previews visitor, client, two
photographers, studio manager and administrator roles. Primary navigation changes
with role; studio management tabs also require manager membership in the selected
studio. **Account role** derives a demo role from the existing real account, without
changing authentication or live permissions. Login, signup and password recovery
continue to use their existing real Supabase flows.

`/projects`, `/bookings`, `/messages`, `/portfolio`, `/studio`, `/profile`, `/settings`,
`/notifications` and `/admin` now demonstrate operations with shared in-memory state.
Switch roles to follow the same booking through brief approval, assignment,
confirmation, collaboration, proofing, delivery and review. Admin can simulate the
168-hour completion countdown and apply/release a dispute hold. No automatic review
is generated. There are seeded examples at each booking stage.

New operational interactions call no business mutation endpoint. Files use local
object URLs; content moderation changes only a local visibility overlay. A request
from an actual public provider page creates a local booking/conversation and assigns
a demo representative to handle the provider side. It is not a real booking or message.
Explore uses basic frontend text matching and existing public catalog/tag reads;
reference files are not uploaded and no new AI search request is made.

Reloading or **Reset demo** discards all workflow changes. Demo data does not change
Supabase rows, roles, publication state, RLS, Storage policies or existing credentials.
See [UI-003](../../plans/tasks/UI-003.md) for the role/use-case matrix, limits and
verification evidence.

# Configuration change inventory

No configuration file was modified in this documentation session. DevOps should review these after the contracts and Cloud project are ready.

| File or command                                         | Current assumption                                                     | Future change                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `.env.example`                                          | Local Supabase URL and DB URL; MVP branch AI Gateway values            | Cloud URLs and clearly separated browser/server secrets; AI service connection                                             |
| `supabase/config.toml`                                  | Local ports/Auth redirects/seed                                        | Historical/reference only for ordinary development; Cloud Auth configured in dashboard/API                                 |
| Root `package.json`                                     | `db:start/stop/status/reset`, local type generation, MVP demo commands | Remove local Supabase commands from the normal workflow; add Cloud migration/type commands with an explicit project target |
| `scripts/db-types.mjs`                                  | `supabase gen types ... --local`                                       | Generate against designated Cloud project with access control and failure-safe output                                      |
| `scripts/local-env.mjs` (MVP branch)                    | Reads local Supabase status for demo                                   | Replace with credential provisioning guidance; never scrape hosted secrets                                                 |
| `scripts/dev.mjs`, `start-dev.bat`                      | Starts shared/API/web; no Python                                       | Add optional replacement AI service orchestration if chosen                                                                |
| `apps/api/src/config/env.ts`, `apps/web/src/lib/env.ts` | Validate local-oriented settings                                       | Validate Cloud endpoints, CORS and AI-service URL; keep server-only values private                                         |
| `.github/workflows/ci.yml.disabled`                     | Inactive                                                               | Design active checks, migration review and secret handling later                                                           |
| Root scripts, `scripts/start-dev.bat`, setup guides     | Updated in the current repository to call `pnpm` directly              | Follow [pnpm without Corepack](pnpm-without-corepack.md); apply the same change to MVP-only scripts when transferred       |

The MVP README and `docs/db/local-development.md` will need revision when implementation changes land. Development, integration tests and migration rehearsal should use designated Supabase Cloud projects; no local Supabase dependency should remain in the target workflow.

# MVP-001 verification

Environment: Windows, Node 22.19.0, pnpm 9.15.0; feature/MVP-001-ai-focused-workflow.

| Check                   | Status  | Evidence                                                                                              |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| Remote baseline         | Passed  | git fetch origin --prune; feature branch based on 82b1327                                             |
| Docker/Supabase         | Passed  | Started local Linux engine and project services; no hosted DB used                                    |
| Migrations/types        | Passed  | Fresh bootstrap of initial migrations, incremental migrations 4–8, successful db:types                |
| pnpm check              | Passed  | Formatting, documentation scan, ESLint, typecheck, 22 Vitest tests and production builds              |
| pnpm test:db            | Passed  | 22 workflow/RLS/conflict/assignment/action/recovery/budget checks, including concurrent confirmations |
| pnpm test:e2e           | Passed  | 3 real-browser scenarios, latest run 17.1 seconds                                                     |
| Worker startup          | Passed  | Configured worker started; empty queue and reference maintenance ran without errors                   |
| Visual/console          | Passed  | 1280px English/Vietnamese and 375px mobile screenshots; no page errors or horizontal overflow         |
| pnpm ai:evaluate        | Blocked | Rejected missing AI_GATEWAY_API_KEY before model calls; benchmark dataset expansion still required    |
| Real model human review | Not run | Requires budgeted credentials; no mock product AI responses substituted                               |
| Team/PR review          | Not run | No reviewer approval or protected-branch integration claimed                                          |

## Browser flow

English remains the default, including in a Vietnamese browser context. Selecting
Vietnamese updates navigation, forms, control catalogs, errors and document language;
reloading preserves the selection. Switching while editing preserves field input.
The mobile page fits 375px and the language control is keyboard focusable.

Separate client/manager sessions create a project and booking, assign a photographer
and room, agree a brief, start the shoot, upload real image bytes, select previews,
upload/deliver finals, complete the booking and review it. A third unrelated account
cannot access the room. These use real Auth, API, DB and Storage services.

## Corrections verified

- Replaced repeated composite-function expansion with a single FROM function call.
- Exposed PostgreSQL genre enums as arrays to prevent browser render failures.
- Serialized studio membership checks against booking assignment.
- Prevented controls racing an in-flight approval/cache refresh.
- Corrected selector labels and localized Astryx's required-field strings.
- Fixed successful DELETE/204 handling and localized retained machine errors.
- Allowed the commit hook to honor ESLint ignores for generated database types
  without treating the ignored-file notice as a failed lint check.

## Limits and remaining work

No destructive reset was performed after seeding. Functional DB fixtures roll back;
concurrency fixtures are deleted by exact generated IDs. Browser demo bookings are
retained as history. The input PDF remains untouched.

Vite builds successfully with a remaining vendor chunk warning (~870 kB before gzip,
~252 kB gzip). Pages/chat load separately. No hosted performance claim is made.

After setting a capped Gateway key, restart API/worker, expand to 100–200 permitted
labeled images, run `pnpm ai:index`, then `pnpm ai:evaluate`. Inspect real concepts,
briefs, culling and edited outputs. Retrieval recall and output quality remain unverified.

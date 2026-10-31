# SETUP-001: Implementation plan

## Approach

Use the existing pnpm workspace and product decisions. Build a usable local foundation before business features. Preserve report/ and the user's source PDF.

## Changes and interfaces

- Move agent guidance to agents/ with domain guides, workflow, and reusable templates; explicitly load agents/README.md.
- Compile shared ESM/declarations and use NodeNext for API/shared; keep Vite bundler resolution for web.
- Separate Fastify construction/listening, validate environment settings, constrain CORS, redact logs, preserve GET /health.
- Add minimal routing, TanStack Query, and verified Astryx API health states.
- Provide root Corepack-compatible development/check/database commands and local hooks.
- Pin project Supabase CLI; validate local configuration. No business migrations or default Python execution.
- Translate existing documentation outside report, retain draft business rules/open questions, and add product/architecture/backlog artifacts.
- Disable workflow discovery; use local verification and reviewed PRs.

## Verification

Frozen install; pnpm check; health/configuration/CORS/response tests; compiled Node startup from another working directory; root environment/process precedence; browser loading/error/success/retry/not-found at 375px/1280px; shared source propagation; type-generation failure preservation; documentation links/language and endpoint/diagram preservation; hook validation; clean snapshot install/check.

## Defaults and delivery

Node 22 (minimum 22.13), pnpm 9.15.0, local Docker Supabase, one agent task, local IDs and optional real Jira. SETUP-001 branches from main and targets main through a reviewed PR once; synchronize dev through a reviewed PR after approval/merge. Docker prerequisites can block database checks without blocking health-only app development. AI, Tauri, hosting, CI/CD, and business schema decisions remain deferred.

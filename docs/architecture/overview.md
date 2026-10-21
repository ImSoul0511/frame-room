# Architecture overview

## Current flow

Browser load -> TanStack Query -> GET /health -> Fastify -> shared Zod validation -> browser response validation -> status display. This path has no database dependency.

The pnpm workspace contains a Vite SPA, Fastify API, and compiled ESM shared package. Shared builds before consumers and is watched in full development. API/shared use NodeNext and .js imports; web uses bundler resolution. Compiled API runs with Node, importing shared JavaScript rather than TypeScript source.

Root environment files are loaded explicitly. API process settings override .env. Only VITE_ variables are browser-visible. The API validates consumed settings and restricts CORS to WEB_ORIGIN.

## Planned boundaries

- Web calls Supabase Auth for sessions and the API's /v1 endpoints for business operations.
- Services enforce authorization/state changes; repositories/SQL functions handle data/transactions.
- Web uploads under Storage RLS, then asks the API to record validated storage paths.
- Web subscribes to authorized Realtime reads; business writes remain through the API.
- SQL migrations define schema, constraints, indexes, triggers, and RLS.
- Shared Zod schemas define implemented wire contracts; larger API/ERD drafts remain designs.

Service-role keys bypass RLS and are server-only; future privileged paths need explicit authorization. Health does not consume DB credentials.

## Future desktop

Keep browser code portable and API URLs configurable. Tauri may later host the static build; native capabilities, auth callbacks/deep links, origins, and desktop permissions require a separate task. Do not introduce Rust/Tauri now.

See [ADRs](../adr/README.md), [API draft](../api/contract_v0.md), [ERD](../db/erd_v0.md), and [database workflow](../db/local-development.md). CI/CD and hosted environments are disabled; local verification is the current gate.

# Architecture overview

## Current flow

Browser -> Supabase Auth -> bearer-verified Fastify APIs -> services -> PostgreSQL
transactions. TanStack Query owns server state; language preferences use a small
external store with matching dictionaries and Astryx catalogs. Health is independent.

The pnpm workspace contains a Vite SPA, Fastify API, and compiled ESM shared package. Shared builds before consumers and is watched in full development. API/shared use NodeNext and .js imports; web uses bundler resolution. Compiled API runs with Node, importing shared JavaScript rather than TypeScript source.

Root environment files are loaded explicitly. API process settings override .env. Only VITE_ variables are browser-visible. The API validates consumed settings and restricts CORS to WEB_ORIGIN.

## Implemented boundaries

- Web calls Supabase Auth for sessions and /v1 APIs for business operations.
- Services enforce authorization/state changes; repositories/SQL functions handle transactions.
- API-mediated uploads verify image bytes with Sharp and create paired WebP thumbnails before registration.
- Web subscribes to authorized Realtime messages and refreshes other workspace data; writes remain API-only.
- SQL migrations define schema, constraints, indexes, triggers, and RLS.
- Shared Zod schemas define implemented wire contracts; larger API/ERD drafts remain designs.

Creative Projects retain ideas/references, generated artifacts and assistant context
before and after booking. AI SDK routes through a server-only Gateway key. Text and
reference-image searches produce shared visual descriptions and 768-dimensional
vectors; SQL applies explicit filters and groups visible portfolio matches by provider.

The worker consumes pgmq jobs for indexing, concepts, edits and culling. Job records,
artifacts and budget reservations survive restart. An interrupted paid call becomes
uncertain instead of being blindly retried. A separate confirmation transaction
applies proposals through normal business services with current permissions/versions.

See [MVP contract](../api/mvp.md), [database access](../db/mvp.md), and
[ADR 0004](../adr/0004-ai-focused-mvp.md). Hosted rollout and CI/CD remain deferred.

Service-role keys bypass RLS and are server-only; future privileged paths need explicit authorization. Health does not consume DB credentials.

## Future desktop

Keep browser code portable and API URLs configurable. Tauri may later host the static build; native capabilities, auth callbacks/deep links, origins, and desktop permissions require a separate task. Do not introduce Rust/Tauri now.

See [ADRs](../adr/README.md), [API draft](../api/contract_v0.md), [ERD](../db/erd_v0.md), and [database workflow](../db/local-development.md). CI/CD and hosted environments are disabled; local verification is the current gate.

# Development environment

Use Node 22 and pnpm 9.15.0. `pnpm dev` starts the shared-package watcher, Fastify on port 4000 and Vite on port 5173. Vite exposes browser settings prefixed with `VITE_`. The optional AI worker starts with `pnpm dev:worker`.

Follow the [Cloud preview guide](supabase-cloud-preview.md) for hosted Auth, catalog, PostgreSQL and Storage settings. Local development can use the Supabase CLI and Docker with `supabase/config.toml`. The [root README](../../README.md) lists setup commands. `GET /health` checks API liveness. Feature tests also require the corresponding data services.

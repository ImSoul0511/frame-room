# ADR 0001: Workspace and runtime boundaries

Status: Accepted. Date: 2026-10-21. Task: SETUP-001.

## Context

Shared exported TypeScript source and the API inherited browser bundler settings. The product needs reproducible web development and may later gain a desktop wrapper.

## Decision

Retain pnpm 9.15.0, Node 22 (minimum 22.13), React 19/Vite/Astryx, and Fastify. Compile shared ESM JavaScript/declarations. API/shared use NodeNext; web uses bundler resolution. Build shared before consumers; watch it in full development.

Use local Supabase with a pinned project CLI and Docker. SQL migrations define actual schema; business schema follows contract review. Preserve the optional Python scaffold but defer AI, pgvector/model selection, Tauri, and hosting.

## Consequences

Built API runs without a TypeScript runner. Web remains a static SPA. Shared needs an initial build. Docker/Python are not prerequisites for health-only web/API development; Docker is required for local database checks.

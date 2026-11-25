# Architecture overview

The React/Vite SPA calls Supabase Auth for sessions and Fastify for business operations. The API verifies the bearer token and enforces membership, ownership and state changes. Repositories and SQL functions handle database transactions. Only `VITE_` environment variables are exposed to the browser.

The pnpm workspace builds the shared Zod package before the API and web consumers. The API and shared package use compiled ESM. The web uses React Router for navigation and TanStack Query for server state. See the [frontend data flow](../frontend/frontend-data-flow.md).

Media uploads pass through Sharp before writing to Supabase Storage. Album images, previews and avatars use WebP. Final deliveries use full-resolution WebP within the format and size limits. See the [storage guide](../database/storage-configuration.md).

Creative projects retain ideas, references, generated artifacts and assistant context. The API calls the model gateway with a server credential. The worker processes jobs and records budget reservations. Project proposals require confirmation before a business write. Explore uses catalog keyword and taxonomy filters.

See the [API contract](../api/mvp.md), [AI capabilities](../ai/current-ai-capabilities.md), [ERD](../database/erd.md) and [migration workflow](../infrastructure/migration-workflow.md).

# ADR 0004: AI-focused bilingual MVP

Status: authorized for implementation by the user on 2026-10-30; team review pending.

## Decision

Retain React/Vite/Astryx, Fastify/Node 22, shared Zod and local Supabase. Implement
AI discovery, concepts, shoot planning, room assistance, culling, image editing and
confirmed business actions using AI SDK 7 and AI Gateway, rather than deferring AI.
Use TypeScript workers, pgmq and pgvector; no Python runtime is required.

Adopt the explicit profile initialization recommendation from ADR 0003. Preserve
Auth IDs, membership-derived authority and the existing booking state machine.
Private rooms are scoped to the client, current assignee and relevant managers.

The user's subsequent amendment requires English by default and Vietnamese as a
persistent selectable language. Both app dictionaries and Astryx component catalogs
follow this preference. Requests carry Accept-Language, and queued jobs retain the
language selected at submission. Browser language does not override the default.

Use a shared $30 monthly AI cap, 100 generated/edited outputs per month, bounded
tokens/timeouts, conservative in-flight reservations and Gateway-reported billed
cost when available. Unknown paid outcomes retain reservations and require review.
Gateway key budgets must also be configured before enabling actual paid use.

## Consequences

This supersedes the foundation's AI deferral and Vietnamese-only product guidance.
It does not authorize a deployment, protected-branch merge, or invented reviewer
approval. The current feature branch preserves unmerged foundation changes.

The [MVP API contract](../api/mvp.md) records implementation differences from draft
v0, including API-mediated image normalization and explicit profile creation.

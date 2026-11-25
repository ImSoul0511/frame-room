# Shared contract guide

Read [contribution rules](../docs/contributing.md), the [API contract](../docs/api/mvp.md), and the [ERD](../docs/database/erd.md).

For a behavior, wire format or access change, load the [contract-change skill](skills/frameroom-contract-change/SKILL.md). Profile creation and photographer registration use the [profile routes](../apps/api/src/routes/profile.ts).

Shared contains runtime Zod schemas and inferred types. Public exports point to compiled ESM/declarations, not raw TypeScript. Build before consumers and verify Node/Vite resolution.

Keep fields, enums, IDs, and errors aligned. Preserve Auth IDs; application UUIDv7 requirements do not change users' IDs. Registration offers client/photographer only; manager authority is derived.

Draft contract sections are not implemented schemas. Do not mass-generate business types or freeze open questions during foundation work.

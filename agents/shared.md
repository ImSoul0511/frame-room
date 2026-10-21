# Shared contract guide

Read [contribution rules](../docs/contributing.md), [API draft](../docs/api/contract_v0.md), and [ERD](../docs/db/erd_v0.md).

Shared contains runtime Zod schemas and inferred types. Public exports point to compiled ESM/declarations, not raw TypeScript. Build before consumers and verify Node/Vite resolution.

Keep fields, enums, IDs, and errors aligned. Preserve Auth IDs; application UUIDv7 requirements do not change users' IDs. Registration offers client/photographer only; manager authority is derived.

Draft contract sections are not implemented schemas. Do not mass-generate business types or freeze open questions during foundation work.

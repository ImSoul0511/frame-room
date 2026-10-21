# Shared contract guide

Read [contribution rules](../docs/contributing.md), [API draft](../docs/api/contract_v0.md), and [ERD](../docs/db/erd_v0.md).

For a behavior/wire/access change, load the [contract-change skill](skills/frameroom-contract-change/SKILL.md). Keep the [profile-initialization ADR](../docs/adr/0003-auth-profile-initialization.md) proposed until reviewed.

Shared contains runtime Zod schemas and inferred types. Public exports point to compiled ESM/declarations, not raw TypeScript. Build before consumers and verify Node/Vite resolution.

Keep fields, enums, IDs, and errors aligned. Preserve Auth IDs; application UUIDv7 requirements do not change users' IDs. Registration offers client/photographer only; manager authority is derived.

Draft contract sections are not implemented schemas. Do not mass-generate business types or freeze open questions during foundation work.

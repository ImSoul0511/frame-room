# PLAN-001 MVP reconstruction work allocation

Status is In Review. Prepared on 2026-11-12 for Khoi Nguyen and the FrameRoom team.

## Goal and scope

Plan reconstruction on `dev` through 2026-11-15, using
`feature/MVP-001-ai-focused-workflow` as a read-only reference. Deliver the requested
Backend, Database and AI Search work guides for humans working with coding agents.

- [Backend allocation and conventions](../../docs/backend/mvp-rebuild-work-plan.md)
- [Database learning and operations guide](../../docs/database/mvp-cloud-work-guide.md)
- [AI Search, taxonomy and data plan](../../docs/ai/ai-search-work-plan.md)

## Dependencies and open decisions

The guides reserve `BE-101` through `BE-108`, `DB-101` through `DB-105`, and `AIS-101`
through `AIS-105`. These are local planning IDs. Implementers create their matching
`plans/tasks/<ID>.md` artifacts before implementation. Existing backlog epic IDs retain
their meaning. The guides identify contract, model, corpus and Cloud decisions for the
assigned owners to record.

## Acceptance criteria

- [x] Inspect repository conventions, current branches and MVP source.
- [x] Allocate the complete documented endpoint surface and its business invariants.
- [x] Give a beginner executable Cloud workflow, ERD review method and mentor checkpoints.
- [x] Prioritize AI Search with code, data, taxonomy, scripts and evaluation ownership.
- [x] Include branch names, hook-compatible commits, dependencies and dated checkpoints.
- [x] Verify local links, formatting and endpoint allocation coverage.
- [ ] Obtain team review of assignments, estimates and proposed decisions.

## Contract impacts

The guides propose implementation order and explicitly identify possible schema/internal
AI contract additions. Application contracts and database runtime state receive changes
through the subsequent implementation tasks.

## Evidence and handoff

Inspected `main`, `dev`, `origin/main` and `origin/dev` at `30e5373`, and the MVP at
`66f3779`, after fetching origin. Planning branch is
`chore/PLAN-001-mvp-rebuild-planning`. The existing untracked frontend manifest belongs
to the user.

Verification completed on 2026-11-12.

| Check                                          | Result                                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                                   | Passed formatting, local documentation links/translation scan, ESLint, typecheck, 11 tests and workspace builds. The web build reports its existing large-chunk warning. |
| Endpoint allocation comparison                 | All 90 inventory method/path pairs appear exactly once in the allocation table.                                                                                          |
| Commit examples through `pnpm exec commitlint` | All 13 examples passed.                                                                                                                                                  |
| Supabase CLI help                              | Confirmed version 2.121.0 and the documented push/list/type-generation flags.                                                                                            |
| MVP fixture byte inspection                    | Confirmed 12 Vietnamese queries contain 89 literal question marks in the UTF-8 source, supporting the fixture-repair task.                                               |

The initial repository-check attempt hit a permission error reading an existing
`.artifacts` subdirectory. The authorized rerun completed successfully. Cloud setup,
data ingestion and model evaluation are future implementation activities.

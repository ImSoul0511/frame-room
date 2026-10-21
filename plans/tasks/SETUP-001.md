# SETUP-001: Workspace foundation

Status: In Review
Owner: Workspace implementer
Jira: Not linked; local task authorized by the user
Branch: chore/SETUP-001-workspace-foundation
Base: main, one-time approved exception

## Goal and scope

Reproducible web/API, agents/ guidance, lean English artifacts. Preserve report/ and source PDF. Keep current roles/studio decisions. Defer business features, AI implementation, Tauri, hosting, and CI/CD.

## Dependencies and decisions

Node 22 (minimum 22.13), pnpm 9.15.0, Corepack. Docker Linux engine for local DB only. Explicit agent prompt, no root AGENTS.md. Local IDs/optional Jira. Reviewed setup PR into main, reviewed dev sync afterward. No business migrations.

## Acceptance criteria

- [x] Frozen install and pnpm check pass.
- [x] Compiled Node API health matches shared.
- [x] Environment and CORS tests pass.
- [x] Astryx renders at 375px/1280px with accurate health states.
- [x] Shared edits propagate in full dev.
- [x] Supabase starts/resets, or blocker is recorded.
- [x] English docs outside report, valid links, reusable agent templates.
- [x] No root AGENTS.md or active workflow.
- [ ] Reviewer approves PR; dev synchronization follows reviewed merge.

## Contract impacts

Unchanged health response. Shared exports compiled ESM/declarations. Business API/ERD translated; AI marked deferred; open decisions retained. No business schema implemented.

See [implementation plan](SETUP-001-plan.md), [verification](SETUP-001-verification.md), and [handoff](SETUP-001-handoff.md). Checkboxes follow evidence.

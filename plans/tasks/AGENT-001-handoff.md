# AGENT-001: Handoff

## Outcome

Three explicitly routed [project skills](../../agents/README.md#focused-skills) and an [auth packet](../../docs/features/auth/packet.md) make the next feature reviewable. [ADR 0003](../../docs/adr/0003-auth-profile-initialization.md) recommends explicit onboarding while remaining Proposed. Neither contract/ERD question #1 nor any endpoint/schema is accepted by this delivery. See [task](AGENT-001.md), [exercises](AGENT-001-exercises.md), and [verification](AGENT-001-verification.md).

## Reproduce

From the repository root, run `corepack pnpm docs:check` and `corepack pnpm format:check`. With the installed skill-creator tooling, run `python C:/Users/phanp/.codex/skills/.system/skill-creator/scripts/quick_validate.py <skill-folder>` for each of the three folders. That validator is environment-provided tooling, not a new project dependency. Re-run the read-only prompts from the exercise artifact when changing these skills.

## Review and next work

This branch depends on the unmerged foundation [PR #2](https://github.com/ImSoul0511/frame-room/pull/2); retain a stacked draft review until that foundation is integrated. Retarget/rebase onto dev afterward; obtain reviewer approval before merging. No direct main/dev push or automated deployment is part of this task.

Khai/Ly should decide G1 initialization, errors/retries and recovery; Khoa reviews compatibility and screens. G2 settles email/password/callback verification, G3 confirms copy/navigation/logout scope, and G4 reviews SQL/RLS execution. Record acceptance in the ADR and reconcile API/ERD before AUTH-001 adds schemas, migrations, endpoints, or screens. Product follow-ups retain the backlog order; password reset, Google OAuth and studio creation are outside this first auth slice.

Browser auth acceptance, local Docker replay, denied-access/RLS tests and type generation have not run because this pass contains no implementation. Skill metadata does not install/register the folders. Report content and the source PDF remain preserved.

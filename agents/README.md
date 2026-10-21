# Agent workspace

**Startup prompt: Read `agents/README.md` before working.**

This folder is the explicit entrypoint. No root AGENTS.md is provided; supply this prompt to assistants that only auto-discover that filename.

## Reading order

1. Read the [README](../README.md) and [contribution rules](../docs/contributing.md).
2. Confirm root; inspect git status/branch, commits, and existing changes; fetch origin with pruning. Preserve work and report unavailable refs.
3. Read the assigned task in plans/tasks/, its acceptance criteria, relevant contract/ERD sections, and domain guide.
4. Follow the [workflow](workflow.md).

| Domain           | Guide                   |
| ---------------- | ----------------------- |
| Frontend         | [frontend](frontend.md) |
| Backend          | [backend](backend.md)   |
| Shared contracts | [shared](shared.md)     |
| Database         | [database](database.md) |
| Review           | [review](review.md)     |

## Focused skills

Load a skill only when the task matches its description; read its SKILL.md before following it. These folders are project resources, not a promise of assistant-native discovery. Their optional agents/openai.yaml files provide metadata if a supporting host later registers them; this task does not install or register user-level skills.

| Task                                                               | Skill                                                              | Leave unloaded for                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Specify/build/review a FrameRoom screen or form                    | [Astryx screen](skills/frameroom-astryx-screen/SKILL.md)           | API-only work, translation, generic React questions   |
| Change a wire contract, business state, validation, or access rule | [Contract change](skills/frameroom-contract-change/SKILL.md)       | Styling/copy changes without behavior impact          |
| Plan/review/implement a concrete SQL/RLS change                    | [Supabase migration](skills/frameroom-supabase-migration/SKILL.md) | Screen-only work, general Auth questions, deployments |

Example: "Read agents/README.md, then use agents/skills/frameroom-astryx-screen/SKILL.md to specify AUTH-S01 from the auth packet. Produce a plan only; do not edit application code."

Use multiple skills only when their boundaries are actually crossed. An auth screen specification can load the screen skill; a proposed onboarding endpoint needs contract analysis; SQL implementation waits for approved schema decisions. A typo-only task needs none. Skills support the current task's scope and never expand its execution authority.

The [auth feature packet](../docs/features/auth/packet.md) is the first worked specification. See [AGENT-001](../plans/tasks/AGENT-001.md) for its skill exercises and verification.

User instructions take precedence; keep guidance consistent. Contribution rules own detailed policies. All documentation outside report/ is English. Do not modify reports or input files unless assigned. Work one task at a time; no sub-agent delegation by default. Never invent evidence, Jira keys, implementations, secrets, or product decisions.

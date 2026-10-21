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

User instructions take precedence; keep guidance consistent. Contribution rules own detailed policies. All documentation outside report/ is English. Do not modify reports or input files unless assigned. Work one task at a time; no sub-agent delegation by default. Never invent evidence, Jira keys, implementations, secrets, or product decisions.

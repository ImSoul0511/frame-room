# ADR 0002: Agent artifacts and local verification

Status: Accepted. Date: 2026-10-21. Task: SETUP-001.

## Context

The user requested folder-based agent guidance, English documentation outside report, local development, and disabled CI/CD.

## Decision

Use agents/ with an explicit startup prompt and no root AGENTS.md. Work one task at a time with local IDs and optional real Jira links. Store filled plans/evidence/handoffs under plans/tasks/.

All documentation outside report/ is English; reports retain their language. Vietnamese UI strings are separate from documentation.

Retain the old workflow with a .disabled extension. Local checks and reviewer approval replace CI/staging gates. SETUP-001 branches from current main and targets main once; synchronize dev afterward through a reviewed PR.

## Consequences

Assistants that discover only root instructions require the explicit prompt. No automation/deployments run from this workflow. Human review remains required. Infrastructure checks do not prove product completion.

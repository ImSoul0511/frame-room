---
name: frameroom-astryx-screen
description: Specify, implement, or review FrameRoom application screens using the installed Astryx components, shared contracts, and observable UI states. Use for a screen or form task; skip API-only, database-only, documentation translation, and generic React questions.
---

# FrameRoom Astryx screen

## Inputs and scope

Read the assigned task, screen brief, and API dependencies. Start with the [frontend guide](../../frontend.md) and relevant [contract](../../../docs/api/contract_v0.md) sections. Inspect existing pages, strings, styles, and package versions before proposing changes.

Honor the requested mode: a specification or read-only exercise produces artifacts only. Implement UI only when the task authorizes implementation. A mock or proposed endpoint is not a working integration. Record missing decisions and continue independent screen work without settling product policy.

## Workflow

1. Identify actor, entry/exit navigation, required data, permissions, and observable success. Mark dependencies as implemented, draft, or proposed. For auth, consult the [auth packet](../../../docs/features/auth/packet.md); profile initialization is unresolved until ADR acceptance.
2. Inspect installed Astryx APIs from the repo root with `corepack pnpm --filter web astryx component --list`, then `corepack pnpm --filter web astryx component TextInput Button`. Inspect other selected components and theme tokens on demand. Record actual import paths/props; resolve missing components through discovery. Do not run init, upgrade, or swizzle as an incidental lookup.
3. Map each UI need to an existing component and theme token. Reuse the current Theme/CSS setup; add custom styles only for a demonstrated gap. Keep layout responsive without inventing a second design system or copying an entire CLI catalog into docs.
4. Specify initial, loading/submitting, success, failure/retry, and relevant empty states. Define field errors, duplicate-submit handling, navigation, focus recovery, and what remains editable after failure. Mark inapplicable empty states explicitly.
5. Use TanStack Query for API server state and mutations, local state for form input, and the Auth client's session lifecycle for authentication. Do not cache passwords/tokens in query keys, URLs, task artifacts, or custom persistent form storage. Clear user-scoped queries on sign-out/account changes. Import implemented shared validation when available; label future schemas as proposals.
6. Keep Vietnamese product copy in the dedicated strings module; write specifications in English. Client guards are navigation aids; server/DB permissions remain authoritative. Retain browser portability for future Tauri without implementing desktop behavior.
7. Define or perform checks appropriate to the task: 375px/1280px, keyboard-only completion, accessible labels/errors/status announcements, real request/response validation, failure recovery, and relevant automated checks. Distinguish planned scenarios, mock checks, and actual runtime evidence.

## Output and completion

Produce a screen specification or scoped implementation with: component/import mapping and lookup evidence; data/permission dependencies; state/action/navigation table; validation and strings ownership; accessibility/responsive scenarios; unresolved decisions and verification status. Link the task's [verification artifact](../../templates/verification.md).

Complete when every required interaction has an observable outcome and its evidence or remaining prerequisite is stated. Do not report a browser or auth flow as passed from a paper exercise.

# SETUP-001: Handoff

## Outcome

Delivered as [draft PR #2](https://github.com/ImSoul0511/frame-room/pull/2), targeting main. Implementation commit: 35783e5. Reviewer approval is pending; no merge or dev synchronization has been performed.

Implemented a runnable pnpm foundation with compiled shared ESM, a testable Fastify API, validated settings/CORS/redacted logging, Astryx routing and live API status, local quality hooks/checks, and pinned local Supabase commands.

Agent guidance lives entirely under agents/. Product/architecture/ADR/backlog/task artifacts are linked. Existing documentation outside report/ is English; reports and the untracked source PDF are preserved. Business contract identifiers and open questions remain intact; AI is deferred and the GitHub workflow is disabled in the proposed branch.

See [verification](SETUP-001-verification.md), [task](SETUP-001.md), and [implementation plan](SETUP-001-plan.md).

## Reproduce

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm dev
```

Web: http://localhost:5173. API: http://localhost:4000/health. Build and use corepack pnpm --filter api start to run the compiled server. Full dev watches shared changes; individual dev commands build shared once.

Tell the assistant: Read agents/README.md before working.

## Remaining work

- Obtain setup PR approval before merging into main.
- After merge, synchronize main into dev through a separate reviewed PR; no direct push to protected branches.
- Start Docker's Linux engine and verify db:start/local reset. The current engine is stopped; database checks are not claimed passed.
- Business migrations/auth/portfolio/booking/room/delivery features remain in the backlog, with existing open product decisions.
- AI implementation, Tauri, hosting, and CI/CD re-enablement need separate tasks.
- Build has a recorded non-failing bundle-size warning. No model weights, private datasets, screenshots, builds, or dependency folders are committed.

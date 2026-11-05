# Git transition plan

**Recommendation; no commands here have been executed.** The archival source should be the full MVP feature tip `66f3779`, after the team verifies that it contains every intended MVP commit and any uncommitted assets. Creating `archive/mvp` from current `main` would archive only the foundation. A tag at the same commit is an optional immutable audit marker, but the requested branch is the primary archive.

1. DevOps checks `git fetch origin --prune`, `git status --short`, `git log --graph --oneline --decorate --all`, and `git diff --stat main..origin/feature/MVP-001-ai-focused-workflow` in a clean checkout. Reconcile the existing untracked `tasks/` separately.
2. DevOps creates and pushes `archive/mvp` at the verified feature commit, protecting it from force push. Record the full commit SHA and verify the remote ref resolves to it.
3. Keep `dev` at its current foundation commit `a799dea` as the proposed clean development baseline. This avoids rewriting published history. Retain `main` and `dev` history; neither reset nor revert is justified by the inspected graph.
4. Frontend Developer alone transfers the complete MVP web UI to `dev` through a reviewed change, including its dependencies on shared types and API contracts. The handoff must preserve routes, assets, styles, i18n and configuration behavior. A blind copy of `apps/web` will fail because the MVP imports `packages/shared/src/business.ts` and uses API/Auth contracts absent from `dev`.
5. Backend, Database and AI Developers implement their reviewed slices against agreed contracts. DevOps changes infrastructure scripts only in the later implementation phase. Merge in dependency order with integration checks.

Possible later commands, after review, include `git branch archive/mvp <verified-sha>` and `git push origin archive/mvp`. These are examples for DevOps, not an instruction to run them now. Do not cherry-pick the large `d0542a2` wholesale if the goal is independent reconstruction; it includes all four components. No reset/revert is needed to “remove” MVP code from `dev` because the MVP feature branch is unmerged there.

Risk: `feature/MVP-001-ai-focused-workflow` may continue moving; pin the archived SHA explicitly. The local tracking refs may be stale until DevOps fetches. Preserve untracked `tasks/` before any later cleanup. A branch archive preserves code and SQL, not hosted Auth users, Storage objects, secrets or a database dump; capture those separately if the team needs a runnable historical instance.

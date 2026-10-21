# Task workflow

1. **Inspect:** Read the entrypoint/domain guide and existing implementation. Inspect branch/status/commits and fetch refs. Preserve unrelated work.
2. **Define:** Create/link a local task with optional real Jira. Record goal, scope, dependencies, criteria, contract impacts, and open decisions.
3. **Plan:** Describe concrete changes and checks. Resolve blocking decisions before dependent implementation.
4. **Implement:** Use a task branch, stay in scope, and update affected contracts/docs. Do not change business policy during tooling tasks.
5. **Verify:** Run applicable checks and record results/manual scenarios/blockers.
6. **Review:** Inspect scope, secrets, generated files, consistency, and English documentation. Open a PR with evidence and obtain approval.
7. **Hand off:** Record outcome, remaining work/risks, and reproduction commands. Keep In Review/Testing until acceptance and approval are complete.

Use [task](templates/task.md), [plan](templates/plan.md), [verification](templates/verification.md), and [handoff](templates/handoff.md) templates. Filled artifacts live under plans/tasks/. See [contribution rules](../docs/contributing.md) for detailed gates.

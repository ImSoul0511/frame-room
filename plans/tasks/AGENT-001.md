# AGENT-001: Focused skills and auth feature packet

Status: In Review
Owner: Workspace implementer; feature decisions remain with the packet's reviewers
Jira: Not linked; local task authorized by the user
Branch: chore/AGENT-001-auth-skill-packet
Base: chore/SETUP-001-workspace-foundation at d87e6c9; foundation PR [#2](https://github.com/ImSoul0511/frame-room/pull/2) is unmerged

Draft review: [PR #3](https://github.com/ImSoul0511/frame-room/pull/3), stacked on #2. Content commit: 7437b82. Reviewer approval and later retargeting onto dev remain pending.

## Goal and scope

Make focused project skills reusable and demonstrate them through a reviewable email/password onboarding design. Deliver instructions, specifications, and evidence only. Application code, shared schemas, database/configuration, dependencies, report/, and the untracked source PDF are unchanged. AI, Tauri, hosting, and CI/CD remain deferred.

## Deliverables and dependencies

- [Explicit routing](../../agents/README.md#focused-skills) to [Astryx screen](../../agents/skills/frameroom-astryx-screen/SKILL.md), [contract change](../../agents/skills/frameroom-contract-change/SKILL.md), and [Supabase migration](../../agents/skills/frameroom-supabase-migration/SKILL.md). Folder placement does not register skills with an assistant.
- [Auth packet](../../docs/features/auth/packet.md): journey, states, five screens, logout, boundaries, inventory, access cases, and observable acceptance scenarios.
- [Proposed ADR 0003](../../docs/adr/0003-auth-profile-initialization.md): trigger versus explicit API, recommendation, compatibility and recovery requirements. Contract/ERD question #1 stays open.
- [Read-only exercises](AGENT-001-exercises.md), [verification](AGENT-001-verification.md), and [handoff](AGENT-001-handoff.md).

Node/Corepack and installed Astryx support documentation lookup. Python with PyYAML supports skill validation. No Docker/Auth session is needed for this artifact pass; those prerequisites apply to future runtime checks. AUTH-001 depends on foundation integration and accepted packet gates G1–G4, rather than this task merely existing.

## Acceptance criteria

- [x] Three concise skills include triggers, inputs, workflow, outputs, completion criteria, and authoritative links.
- [x] Entrypoint routes matching work explicitly and leaves unrelated tasks unloaded.
- [x] Auth packet distinguishes implemented exports, existing drafts, proposals, and unresolved decisions.
- [x] ADR compares failure/recovery, races, retries, incomplete accounts, consistency, and authorization without accepting a new write path.
- [x] Skill validator, read-only examples, English/link checks, and formatting have recorded evidence.
- [x] App/schema/dependency/report files remain unchanged; no executable SQL, auth routes, or root instruction file is added.
- [ ] Reviewers accept/reject design gates and approve the documentation PR before implementation begins.

## Contract impacts and remaining work

No authoritative operation, schema, or numbered decision changes. API/ERD receive links to the proposal; one untranslated outline label is corrected. The packet proposes an onboarding operation/read-only own-profile lookup for review only. Reconcile those drafts together after G1 acceptance. Review through a stacked draft PR while #2 is pending; after foundation integration, retarget/rebase to dev and obtain approval under normal contribution rules. Do not merge this branch into the unmerged foundation as a substitute for review.

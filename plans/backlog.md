# FrameRoom prioritized backlog

Current implementation: [MVP-001](tasks/MVP-001.md), authorized 2026-10-30. The
AI-focused bilingual plan supersedes the foundation's AI deferral. Verification and
remaining real-model/dataset work are tracked in its linked evidence; team review
is required before merge. No protected branches have been merged by the assistant.

The table below preserves the 2026-10-21 sequencing baseline. It is historical
planning, not a statement that implemented MVP-001 features remain deferred.

| Order | Task                                               | Outcome / exit criteria                                                                            | Dependencies                                           |
| ----- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 0     | SETUP-001                                          | Runnable workspace, English docs, agent artifacts, local evidence, reviewed PR                     | Current main                                           |
| 0a    | [AGENT-001](tasks/AGENT-001.md)                    | Three focused skills, proposed auth packet/ADR, read-only exercises and review handoff             | Foundation branch; review pending                      |
| 1     | [AUTH-001 packet](../docs/features/auth/packet.md) | Review gates G1–G4, then implement approved email/password session/profile slice with access tests | Foundation integration; packet/ADR review; question #1 |
| 2     | PORTFOLIO-001                                      | Photographer/studio profiles, portfolios, permitted uploads, discovery/filtering                   | Auth; taxonomy/quotas                                  |
| 3     | BOOKING-001                                        | Services, membership, brief versions, atomic state/schedule/assignment                             | Auth/portfolio; cancellation policy                    |
| 4     | ROOM-001                                           | Authorized messaging, decisions, milestones; reassignment revokes access                           | Booking; participant scope                             |
| 5     | DELIVERY-001                                       | Proofing, selection rounds, private delivery, completed-booking reviews                            | Booking/room; quotas/expiry/review policy              |
| 6     | AI-001                                             | Review search contract, select/evaluate models, optional pipeline/embeddings                       | Core product; taxonomy/data permission/retention       |
| 7     | DESKTOP-001                                        | Tauri packaging, origins, auth callbacks, native permissions                                       | Stable static web/API                                  |

No dates or Jira keys are invented. Split epics into reviewable tasks first. Dashboard, resource enhancements, moderation, CI/CD re-enablement, and hosting need separate tasks.

## Open decisions

Use numbered [contract](../docs/api/contract_v0.md#20-open-decisions) and [ERD](../docs/db/erd_v0.md#6-open-decisions) questions. Preserve numbering; record owner/outcome in the feature task. Do not silently settle them during setup.

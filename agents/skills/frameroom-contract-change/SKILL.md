---
name: frameroom-contract-change
description: Trace a proposed FrameRoom behavior or API change across the API draft, implemented shared Zod schemas, ERD, migrations, and permissions. Use for wire, lifecycle, validation, or access changes; skip presentation-only edits, spelling fixes, and unrelated API design.
---

# FrameRoom contract change

## Inputs and scope

Read the task and proposed behavior with a before/after example. Inspect the [shared guide](../../shared.md), [API draft](../../../docs/api/contract_v0.md), [ERD](../../../docs/db/erd_v0.md), actual shared exports, and actual migrations. Find implementations before treating documented behavior as shipped.

A review/specification request produces an impact report. Change contracts/code only within an implementation task's authorization. A proposed ADR is not an accepted decision. Keep numbered open questions open until their owners decide; record dependencies without blocking unrelated analysis.

## Workflow

1. Classify each affected operation/schema/table as implemented, existing draft, proposed addition, or unresolved. Capture current caller expectations and the requested behavior.
2. Follow the data through request validation, service rules, response/error schemas, browser consumers, database fields/constraints, RLS/Storage/Realtime access, and generated types. Mark genuinely unaffected layers with a reason; do not invent migrations for a document-only change.
3. Preserve identity/capability invariants: Auth IDs remain unchanged; new business IDs follow existing UUIDv7 rules; registrationRole offers client/photographer only; photographer/manager authority derives from current data; metadata and display specialties grant no authority.
4. Identify wire fields, enum/state transitions, ownership, pagination, nullability, and machine-readable failures that actually change. Follow the existing error envelope/codes/reasons; do not branch on translated messages. Distinguish Supabase Auth errors from FrameRoom API errors.
5. Treat changed permissions, lifecycle behavior, or write side effects as compatibility concerns even when the response shape is unchanged. For example, making GET /me read-only changes the current initialization draft. Do not silently replace it while documenting explicit onboarding.
6. Report implementation gaps and the migration/order/review implications. Link relevant numbered questions and proposed ADRs. If implementation is authorized, synchronize the affected layers together; otherwise show the proposed contract delta separately from the authoritative draft.
7. Define positive/negative cases, compatibility checks, and rollback/failure cases proportional to the change. Preserve existing endpoint identifiers/open-question numbering unless the accepted change explicitly requires otherwise.

## Output and completion

Produce an impact table with layer, current evidence/status, proposed delta, compatibility, verification, and decision/reviewer dependencies. Include example payloads only when they clarify the change; label them proposed. Link the task and relevant [contribution review rules](../../../docs/contributing.md#commits-and-prs).

Complete when every affected layer has a concrete action or justified no-change outcome, and readers can distinguish accepted decisions from proposals. Do not claim shared schemas, endpoints, or database behavior exist without inspecting them.

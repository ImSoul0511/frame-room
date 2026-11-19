# ADR 0003: Profile initialization and onboarding recovery

Implementation update: the user selected option B under
[ADR 0004](0004-ai-focused-mvp.md). The original proposal and named review gates
below are retained as history; no team approval is implied.

Status: **Proposed**. Date: 2026-10-21. Prepared under [AGENT-001](../../plans/tasks/AGENT-001.md) for AUTH-001 review.
Decision owners: Khai and Ly; Khoa reviews API compatibility and screen recovery.
Related: contract/ERD question #1 and [auth packet gates G1/G2](../features/auth/packet.md#8-review-gates-and-follow-ups).

## Context and preserved constraints

An Auth identity and a FrameRoom Profile are distinct records. Profile needs a valid unique normalized user_name and display_name; its id must equal auth.users.id unchanged. Signup intent can be client or photographer, but metadata never grants photographer, studio_manager, or admin authority. Only a photographer row grants photographer capability; only membership grants management authority.

The current [API draft](../api/contract_v0.md#4-personal-profile) allows possible initialization during first GET /me, with error handling still unresolved. The [ERD](../db/erd_v0.md#31-accounts) leaves trigger versus backend initialization open. Shared contains only a small implemented subset, and no business migration or auth endpoint exists. This ADR does not resolve question #1 or change runtime behavior.

## Options

| Concern                   | A: Auth-user insert trigger                                                                                                              | B: Explicit authenticated onboarding API                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Consistency               | Profile creation participates in the Auth-user insert transaction; failure can prevent the account from being created                    | Auth account can exist without Profile; UI/API must support explicit incomplete onboarding                            |
| Validation                | Database function validates untrusted signup metadata; constraints remain authoritative                                                  | API validates request and derives caller from verified identity; DB constraints remain authoritative                  |
| Username reservation      | Typically at Auth creation, potentially before email confirmation                                                                        | At successful Profile creation, after verified identity in this proposal                                              |
| Duplicate race            | Unique constraint rejects a conflicting signup transaction; map failure into a repairable signup experience                              | Unique constraint rejects one Profile write; return 409 user_name_taken and retain the session/form                   |
| Retry after response loss | Determine whether signup/account creation already succeeded without leaking account existence; login/confirmation recovery may be needed | Refetch own Profile; repeated create returns the existing Profile without renaming it                                 |
| Missing/invalid metadata  | Can fail the signup transaction; there is no valid Profile placeholder                                                                   | User can repair input after login; do not fill public username from email                                             |
| Partial failure           | Trigger failure rolls back its transaction; verify no orphan/partial rows within that boundary                                           | Auth signup is separate; Profile transaction rolls back and the Auth account remains available to resume              |
| Error visibility          | Requires carefully tested Auth error handling; do not assume a raw DB error becomes a stable public reason                               | API can use the existing envelope/reasons; transport failures still need refetch/retry                                |
| Authorization             | Trigger uses new Auth ID, never metadata userId/roles; elevated DB execution must be narrowly scoped                                     | Endpoint uses verified caller ID/email status, never body identity/roles; RLS and privileged server checks must agree |
| Operations                | Trigger bugs affect account creation; repair and repeat-signup behavior need testing                                                     | Incomplete accounts are an expected state; resume/retention policy and API availability need design                   |

Supabase's user-management guide describes a profile trigger and notes that trigger failures can prevent signup. That platform behavior motivates testing option A's failure/recovery path rather than treating account creation as guaranteed. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data)

## Recommendation, not an accepted decision

Recommend **B: explicit onboarding API**, with read-only GET /v1/me. This makes taken-username repair and recovery from interrupted profile creation visible to the application without tying every signup to a custom profile trigger. The tradeoff is a real authenticated-without-profile state that every dependent route must handle.

Do not create a minimal invalid Profile to disguise incompleteness, synthesize public usernames from email, auto-delete Auth accounts after an ordinary network failure, or use GET cache/refetch behavior to perform implicit writes.

### Proposed interface delta for review

- Add POST /v1/me/onboarding accepting userName and displayName only. Require verified identity/email according to G2. Derive Profile.id from Auth, normalize/check username atomically, and return 201 with the existing Profile shape on first success.
- On repeated successful creation, return 200 with the existing own Profile, ignoring conflicting creation input rather than silently updating it; edits remain PATCH /v1/me. A 200 retry means "already created," not "requested new username accepted." Frontend shows the actual returned value.
- GET /v1/me becomes read-only. Proposed missing-profile result: 404 NOT_FOUND with details[].reason=profile_required. Invalid/expired identity remains 401; proposed unverified-email creation denial is 403. Keep all details arrays and existing machine-readable error conventions.
- A competing user's username returns 409 CONFLICT with user_name_taken. Enforce both unique username and one Profile per Auth ID; recover a concurrent same-user creation by reading the existing own row after the losing transaction ends.
- Preserve signup metadata fields as untrusted onboarding suggestions. Photographer preference offers a later POST /v1/photographers/me flow and is never copied into authorization storage.

These are proposals, not implemented endpoints, shared types, accepted schema, or migrations. Removing GET initialization is a compatibility change to the draft behavior even without a response-shape change. If reviewers choose option A, replace these proposals with explicit signup-error/duplicate/confirmation recovery specifications before implementation; do not leave two competing creation mechanisms active.

## Review requirements and consequences

G1 acceptance must settle creation timing, duplicate/same-user retry behavior, missing-profile discrimination, treatment of incomplete Auth accounts, and the authoritative write path. G2 must settle confirmation/password/callback settings and verification strategy. A local email-confirmation test needs explicit configuration because local verification defaults differ from hosted behavior. [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)

Upon acceptance, record reviewers/date, reconcile the API draft and ERD together, explicitly resolve their question #1 without renumbering, and create the implementation task. Until then, mark analysis conditional and do not write migration SQL or register routes.

For either option, verify two-user normalized-username races, same-user repeated creation, response-loss recovery, invalid/untrusted metadata, private-data isolation, preserved Auth IDs, and failed-write rollback. The [auth acceptance scenarios](../features/auth/packet.md#6-acceptance-scenarios-for-future-implementation) map those cases to screens and operations. No acceptance test has been executed by writing this ADR.

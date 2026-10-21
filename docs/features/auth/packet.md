# AUTH-001: Email/password and onboarding feature packet

Status: Proposed specification, ready for review; no auth implementation is claimed.
Owner: Feature reviewers, with Khai/Ly resolving profile initialization and Khoa reviewing screens.
Prepared by: [AGENT-001](../../../plans/tasks/AGENT-001.md), 2026-10-21.

## 1. Scope and evidence levels

Specify signup, email confirmation/resend, login/session restoration, required profile completion/recovery, optional photographer setup, and logout. Password reset, Google OAuth, studio creation, avatars/media upload, and other business features are follow-ups. The first photographer form deliberately omits optional styles/taxonomy fields while contract question #2 remains open.

| Evidence level | Meaning in this packet                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Implemented    | Existing health endpoint, role/registration-role schemas, Astryx theme, router, and query provider only                              |
| Existing draft | Profile fields, GET/PATCH /v1/me, public username lookup, POST /v1/photographers/me, profile/photographer tables and role rules      |
| Proposed       | Screen routes, auth state handling, email-confirmation requirement, explicit onboarding API, and missing-profile discriminator below |
| Unresolved     | Profile initialization in contract/ERD question #1; review gates in section 8                                                        |

The [API draft](../../api/contract_v0.md) describes business designs, not shipped endpoints. The [ERD](../../db/erd_v0.md) is not an implemented schema. [ADR 0003](../../adr/0003-auth-profile-initialization.md) compares initialization approaches and remains Proposed. Nothing here supersedes that review or silently changes the authoritative drafts.

## 2. Journey and state model

1. A visitor chooses client or photographer onboarding and submits signup details to Supabase Auth.
2. With email confirmation enabled, show the confirmation/resend screen. A submitted email address or success message grants no application access.
3. Confirmation establishes a session through the selected SDK callback flow, or the user logs in. Resolve session before choosing an authenticated route.
4. Ask the API for the caller's profile. If the accepted initialization design explicitly reports a missing profile, show profile completion; a timeout/500 is a retryable failure, not evidence that a profile is missing.
5. A valid profile makes the user client-ready. A photographer onboarding preference opens the optional photographer form; only successful server-side profile creation grants photographer capability. Clients can enter that form later.
6. Restore the same server-derived state on reload. Logout ends the selected Auth session scope and clears user-scoped application data after confirmed success.

| State                                 | Evidence                                                           | Permitted navigation / next action                                         |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Anonymous                             | No usable SDK session                                              | Public pages, signup, login                                                |
| Awaiting confirmation                 | Signup flow is awaiting verified email; not an authorization claim | Confirmation/resend, login, public pages                                   |
| Authenticated with incomplete profile | Verified identity plus an accepted explicit missing-profile result | Profile completion and logout; no business writes requiring a profile      |
| Client ready                          | API returns a valid own Profile                                    | Client capabilities, optional photographer setup                           |
| Photographer ready                    | API confirms photographer profile/capability                       | Client and photographer capabilities; no studio_manager without membership |

These are UI/application states, not new database enum values or columns. Session resolution, profile fetching, and network failures are transient substates. Never show another account's cached profile while resolving them. If logout/session expiry changes the account, cancel in-flight user requests and remove user-scoped query data before displaying the next account. Do not treat a locally decoded JWT or signup metadata as authorization.

## 3. Screens and interactions

Routes and navigation below are proposed web routes, not API endpoints. Default post-auth destination is the existing home route `/`; a saved return path must be a validated same-app relative path. Do not introduce open redirects.

### AUTH-S01: Signup — /auth/sign-up

- Fields: email, password, userName, displayName, registrationRole (client or photographer). No admin or studio signup option.
- Validate email format; normalize userName with trim/lowercase and the existing 3–30-character pattern `^[a-z0-9][a-z0-9_]{2,29}$`; displayName is 1–60 characters. Password validation must match the reviewed Supabase policy, without trimming or transforming the password. The exact policy is gate G2.
- Send credentials directly to Supabase Auth; signup metadata carries the existing userName/displayName/registrationRole fields. Those values are revalidated later and never grant roles. Username availability is not reserved by a frontend check; reservation timing depends on ADR 0003.
- States: editable initial form; submitting with duplicate submission disabled; field errors; generic account/credential failure; network failure with retry; confirmation-needed success. Avoid exposing whether an email already has an account. Never persist the password in query caches, artifacts, URLs, or custom draft storage.
- Success goes to AUTH-S02 when confirmation is required. Never infer client/photographer readiness from a signup response. A policy/configuration mismatch that returns an immediate session still uses session/profile resolution and is a failing confirmation acceptance case, not an excuse to bypass it.
- Enter submits the form, Tab follows visual order, labels remain visible, and submission errors focus the error summary/first invalid field. Retain safe non-secret inputs after failures; password fields are not restored after navigation/reload.

### AUTH-S02: Confirmation/resend — /auth/confirm; callback /auth/callback

- Show a neutral check-email explanation, a masked address when available in this flow, a resend action, and login/back links. Direct navigation without signup context offers login; it never fabricates account state.
- Resend uses the SDK's signup-confirmation operation. States: ready, sending, sent, rate-limited, and network failure. Respect provider retry timing and do not invent a fixed resend interval. Messages avoid account enumeration.
- Callback states: processing, valid session established, invalid/expired/already-used link, and recoverable network failure. Do not log or retain callback tokens/codes in page URLs after SDK processing. Reused links may offer login/resend; they must not grant a session without SDK verification.
- The callback mode and exact local allowlist are gate G2; this pass implements neither. After a session exists, resolve Profile before navigating to completion/home/photographer setup.
- Resend is an actual button, navigation uses links, and status changes are announced without moving focus repeatedly. Enter activates the focused control; keyboard users can reach recovery links after a callback error.

### AUTH-S03: Login and restoration — /auth/login

- Fields: email and password, with email/current-password autocomplete. Login calls Supabase Auth directly. Treat bad credentials generically; distinguish provider rate limiting/network failure when a stable provider error allows it.
- States: editable, submitting, rejected, rate-limited, session resolving, profile loading, profile-load failure/retry, and resolved. Passwords are not stored as query state or logged.
- On success/reload, use the SDK session lifecycle, then request the API profile. No session returns to login. A missing-profile result follows the accepted G1 contract; existing clients/photographers return to the validated target/home. Unconfirmed accounts follow confirmation recovery.
- Handle expiry through the SDK and bounded retry behavior; repeated authentication failure clears account-scoped data and requests login. An ordinary API/network failure keeps a retry state rather than logging the user out or creating a new profile.
- Keyboard: Enter submits once, pending state prevents duplicate login, errors are announced/focused, and auth resolution does not briefly expose protected content. Password reset is explicitly deferred; do not render a broken reset link.

### AUTH-S04: Complete profile — /onboarding/profile

- Entry requires verified identity and the accepted missing-profile outcome. Fields: userName and displayName. Prefill only as untrusted suggestions from signup metadata, revalidate on the server, and let the user repair a taken/invalid username.
- Same username/displayName constraints as AUTH-S01. The form never accepts userId, roles, admin flags, or an Auth ID replacement. No avatar upload in this slice.
- Under the explicit-API proposal, submit to proposed POST /v1/me/onboarding. The trigger alternative needs its own accepted recovery path; do not ship this operation merely because it is described here.
- States: loading suggestions, editable, submitting, duplicate username, invalid input, retryable service/network failure, session expired, and complete. On 409 user_name_taken, keep the session and form open. After an ambiguous timeout, refetch own profile before retrying creation; never change an existing username as a side effect of retry.
- Successful Profile response updates/invalidate-refetches the own-profile query and proceeds to home or AUTH-S05 based on onboarding intent. Existing profiles bypass this page; edits use the existing PATCH /v1/me design instead.
- Enter submits once, errors are associated with fields, and duplicate-username recovery returns focus to userName without erasing displayName. No-profile is an onboarding state; an empty display/list state is not applicable here.

### AUTH-S05: Photographer setup — /onboarding/photographer

- Entry requires an existing own Profile. Show required photographer displayName (1–60) and genres (1–5 values from the existing Genre draft); optional bio (at most 1000). Optional styles, specialties, location, avatars/covers are deferred from this first form, not removed from the draft contract.
- Submit to the existing draft POST /v1/photographers/me; derive identity server-side. No priceFrom, userId, roles, studio membership, or admin input. Draft genre/request schemas are not yet implemented shared exports.
- States: initial/editable, submitting, field failures, expired session, service/network failure with retry, and created. A 409 existing-profile result triggers a refetch instead of a second profile or client-side role grant. A forbidden response remains an error; do not manufacture eligibility.
- On success, refresh own Profile so roles/photographerId come from the server. A client may skip/back to home; the photographer preference is an intent hint, not an access grant or a forced irreversible account conversion.
- Use labeled genre controls with documented keyboard operation, a logical focus order, and an announced summary for failures. An empty selected-genre set is validation failure; an unavailable genre dependency is an error, not a valid empty option list.

### AUTH-A01: Logout action

Provide logout from authenticated states, including incomplete onboarding. Proposed default is current-session logout with an explicit SDK scope; final scope is gate G3. Disable duplicate actions while pending. On success cancel/remove account-scoped queries and form drafts, stop private subscriptions if present, and navigate to login/public home. On failure show retry and do not claim server sign-out succeeded. Session expiry follows the same cache isolation rules.

Supabase distinguishes local/global sign-out and already-issued access tokens can remain valid until expiry. The acceptance criteria require local UI/cache isolation, not a false claim of immediate universal JWT revocation. [Supabase sign-out](https://supabase.com/docs/guides/auth/signout)

### Shared UI/component plan

| Need                               | Installed Astryx candidate / evidence                                                            | Verification requirement                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Labeled email/password/text fields | TextInput: type, value, onChange(value,event), label, isRequired, htmlName, autoComplete, status | Error association, autocomplete, no password transformation                                  |
| Submit/retry/resend                | Button: type=submit where appropriate, label, isLoading/isDisabled                               | One request per action; keyboard submit/retry                                                |
| Registration intent                | RadioList and RadioListItem, label/value/onChange                                                | Exactly client/photographer; arrow/Tab behavior from installed docs                          |
| Form-level failure/status          | Banner: status/title; useAnnounce from core/hooks for async transitions                          | Banner color alone creates no live region; announce outcomes without duplicate announcements |
| Layout                             | Existing Theme, Card, VStack, Heading                                                            | Reuse tokens; no horizontal overflow at 375px/1280px                                         |

Component selection is a specification backed by installed CLI inspection, not a rendered form. Recheck installed APIs when implementing. English descriptions here become Vietnamese UI strings in the dedicated strings module. No new design system, screen code, or browser verification is delivered by this packet.

Use local form state for input; use TanStack Query for API profile reads/mutations, scoped to the current verified account and cleared on account changes. The SDK owns session persistence/refresh. Do not add passwords/tokens to query keys or duplicate session storage. Shared schemas should validate implemented wire contracts when AUTH-001 adds them.

## 4. Boundary map and contract inventory

| Boundary                 | Data / responsibility                                                          | Current status and change needed                                                    |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Browser -> Supabase Auth | Email/password signup and login; confirmation/resend; session lifecycle/logout | Planned integration; no Supabase client dependency/configuration added in AGENT-001 |
| Browser -> API           | Bearer access token, profile input, photographer input; never password         | Planned routes; API must verify identity and reject forged claims                   |
| API -> PostgreSQL        | Own-profile uniqueness, photographer existence, derived capabilities           | No business migrations/repositories/RLS yet                                         |
| API -> browser           | Existing Profile/Photographer drafts and error envelope                        | Future shared Zod schemas/consumers must match approved contract                    |

| Operation / shape                                  | Inventory status                                                    | Packet treatment                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| roleSchema, registrationRoleSchema                 | Implemented shared exports                                          | Registration remains client/photographer only                                                    |
| Profile, Photographer, Genre, error detail schemas | Existing draft, mostly not implemented in shared                    | Implement only the approved auth slice; preserve userName/displayName limits and role derivation |
| GET /v1/me -> data: Profile                        | Existing draft; may initialize profile under unresolved question #1 | Read-only behavior and missing-profile result are proposed changes, not accepted behavior        |
| PATCH /v1/me                                       | Existing draft                                                      | Existing-profile edits; not silently reused for initial creation                                 |
| GET /v1/users/by-username/:userName                | Existing public draft -> UserSummary plus photographerId            | Public representation excludes email/roles; full public profile UI is outside this slice         |
| POST /v1/photographers/me                          | Existing draft -> 201 Photographer; 409 if present                  | First form uses required fields plus optional bio; no role grant from metadata                   |
| POST /v1/me/onboarding                             | Proposed addition in ADR 0003                                       | Verified caller creates own Profile; no userId/roles input; retries recover own existing profile |
| Missing own Profile                                | Unresolved existing behavior                                        | Proposal: 404 NOT_FOUND with details[].reason=profile_required; needs G1 approval                |

The proposed onboarding request is `{ userName, displayName }`; 201 returns `{ data: Profile }`. A retry after prior success returns 200 with the existing own Profile without silently updating it. Proposed failures: 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 403 FORBIDDEN for unverified identity, 409 CONFLICT with user_name_taken, and standard internal/service failures. These examples do not define deployed interfaces. Reason names profile_required and the unverified-email mapping require reviewer agreement in G1/G2.

Distinguish the Supabase SDK's Auth errors from FrameRoom API codes; do not force provider errors into a nonexistent backend auth endpoint. API errors use the existing envelope with an always-array details field. Frontend actions branch on stable codes/reasons, never translated messages. Backend JWT verification must verify authenticity/claims with a suitable library, not just decode a token. [Supabase JWT guidance](https://supabase.com/docs/guides/auth/jwts)

## 5. Access matrix for review

These are intended server-enforced access cases for AUTH-001, not implemented RLS. Each owner case is paired with an unrelated-user denial; service-role success alone proves no RLS policy.

| Actor                             | Own private Profile                         | Initial own Profile write                        | Own photographer creation                     | Public username lookup              | Privilege rules                                            |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------ | --------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| Anonymous                         | Denied, 401                                 | Denied                                           | Denied                                        | Existing public summary design only | No capabilities from supplied metadata                     |
| Awaiting email confirmation       | No access from signup/email context alone   | No creation via proposed API until verified      | Denied                                        | Public summary only                 | Confirmation page is not authentication                    |
| Verified identity without Profile | Explicit missing-profile behavior awaits G1 | Proposed API permits own validated creation only | Denied until Profile exists                   | Public summary only                 | Cannot send a userId or role grant                         |
| Client ready                      | Read/edit self under existing drafts        | Retry resolves existing self without renaming    | May create own validated photographer profile | Public summary only                 | No manager/admin self-grant                                |
| Photographer ready                | Read/edit self                              | Same retry behavior                              | Existing profile conflict/refetch             | Public summary only                 | No manager without membership                              |
| Unrelated authenticated user      | Cannot read/edit another private Profile    | Cannot initialize for another Auth ID            | Cannot create for another user                | Public summary excludes email/roles | Guessed IDs do not establish ownership                     |
| Manually provisioned admin        | Same own-profile flow                       | No public grant path                             | No implied photographer profile               | Public summary only in this slice   | Additional cross-user admin powers are not introduced here |

Photographer capability follows the actual photographer row; studio_manager follows current membership. Display specialties and registrationRole are never authorization data. Profile IDs equal Supabase Auth IDs unchanged; a photographer business ID follows the existing UUIDv7 policy. Keep private account data separate from the public lookup projection.

## 6. Acceptance scenarios for future implementation

These scenarios are specified, not executed. Use two synthetic users, a real local Auth session for each, and explicit anonymous/expired/forged cases. Local email flows can be observed through the CLI's local mail service. [Supabase password-auth and local email guide](https://supabase.com/docs/guides/auth/passwords)

| ID        | Screen / operation           | Given / when / then                                                                                                                                                                                     |
| --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-AC01 | S01 / Auth signup            | Valid client intent -> confirmation-required outcome; no client/photographer capabilities inferred                                                                                                      |
| AUTH-AC02 | S01 / validation             | Malformed username or invalid input -> associated error, no invalid submission; password unchanged                                                                                                      |
| AUTH-AC03 | S01 / signup failure         | Existing-email or bad-credential outcome -> generic recovery without confirming account existence                                                                                                       |
| AUTH-AC04 | S02 / resend                 | Resend pending/rate-limited/failed -> one pending request, provider timing respected, accessible retry                                                                                                  |
| AUTH-AC05 | S02 / callback               | Valid confirmation -> session/profile resolution; expired/reused/invalid link never bypasses verification                                                                                               |
| AUTH-AC06 | S03 / login                  | Correct credentials -> server-resolved own state; incorrect credentials -> generic error and retry                                                                                                      |
| AUTH-AC07 | S03 / restoration            | Reload with session -> resolve own Profile without flashing private data; network/500 is retry, not missing profile                                                                                     |
| AUTH-AC08 | S04 / proposed onboarding    | Two users race for normalized same username -> one success, one 409 user_name_taken; no duplicate rows                                                                                                  |
| AUTH-AC09 | S04 / proposed onboarding    | Response lost after commit -> refetch/retry returns same own Profile without renaming or duplication                                                                                                    |
| AUTH-AC10 | S04 / ownership              | Forged userId/admin metadata -> no other-user write or elevated roles; owner remains verified Auth ID                                                                                                   |
| AUTH-AC11 | S05 / photographer creation  | Valid Profile with required fields -> one photographer row and server-derived capability; preference alone grants nothing                                                                               |
| AUTH-AC12 | S05 / retry                  | Duplicate/repeated creation -> existing-profile conflict/refetch, not a second row; unauthorized other-user creation denied                                                                             |
| AUTH-AC13 | A01 / logout                 | Successful selected-scope sign-out -> cancel/remove user data and protect routes; failed sign-out -> honest retry state                                                                                 |
| AUTH-AC14 | All / account switch         | User A requests resolve after switch to B -> A's data never renders/caches as B; expired sessions cannot write                                                                                          |
| AUTH-AC15 | All / keyboard and layout    | 375px/1280px and keyboard-only -> labeled controls, visible focus, announced errors/status, no horizontal overflow                                                                                      |
| AUTH-AC16 | Initialization alternatives  | Trigger failure blocks/rolls back its signup transaction; explicit API failure leaves resumable Auth account without partial Profile. Execute only the accepted alternative and its race/rollback tests |
| AUTH-AC17 | Public lookup / private read | Public projection exposes no email/roles; anonymous/other-user requests cannot read private Profile data                                                                                                |

## 7. Conditional implementation sequence

After review gates are resolved: (1) agree contract deltas and test identities; (2) add narrowly scoped schema/constraints/RLS with race/rollback tests; (3) implement token verification and approved own-profile endpoints/shared schemas; (4) add SDK session and screen flows; (5) execute the acceptance scenarios and record actual evidence. Do not equate reviewing this packet with passing those tests.

The [migration skill](../../../agents/skills/frameroom-supabase-migration/SKILL.md) must stop short of executable SQL while G1 is unresolved. Docker availability is an execution prerequisite for later local DB tests, not a reason to skip design or silently use hosted infrastructure.

## 8. Review gates and follow-ups

| Gate | Decision / approval required before dependent implementation                                                                                                                               | Owners                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| G1   | Accept/reject ADR 0003: initialization/write path, missing-profile error, retry semantics, username reservation timing, retained Auth-account recovery; reconcile contract/ERD question #1 | Khai, Ly; Khoa for wire/screen changes  |
| G2   | Confirm email verification requirement in local config; password policy; SDK callback mode, redirect allowlist, unverified-email error mapping, and session validation approach            | Khai, Khoa; Ly for DB implications      |
| G3   | Approve first-slice screens, Vietnamese copy, return navigation, current-session versus global logout, and skipped photographer onboarding                                                 | Khoa, Khai, product owner               |
| G4   | Review scoped schema/RLS matrix and provide running local Docker/mail prerequisites before execution                                                                                       | Ly, Khai; implementer provides evidence |

The recommendation is explicit API onboarding with a read-only GET /me, but G1 remains open. Existing contract/ERD numbering is preserved. Password reset, Google OAuth/linking, studio creation, avatar uploads, richer photographer metadata, and hosted/desktop behavior need separate tasks. CI/CD stays disabled.

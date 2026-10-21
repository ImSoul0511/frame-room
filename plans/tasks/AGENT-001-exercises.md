# AGENT-001: Read-only skill exercises

Method: the current agent read each new SKILL.md and followed it against the prompts below. These are manual, same-agent exercises, not independent agent tests or proof of assistant-native skill discovery. Outputs are the linked packet/ADR and the impact/access notes below. No application or database writes were authorized.

## 1. Astryx screen

Prompt: "Use frameroom-astryx-screen to specify AUTH-S01 from the auth packet. Produce a plan only; do not edit application code."

Inspected installed component docs using `corepack pnpm --filter web astryx component --list`, then `component TextInput Button RadioList Banner` and `component RadioListItem Card VStack Heading`. All selected components were found. An earlier Alert lookup failed; discovery selected Banner instead. Ignored the CLI's incidental init suggestion. Read existing App.tsx/styles.css to confirm Theme/neutralTheme and all three CSS imports; do not recreate setup.

| Selection                 | Observed API / resulting guidance                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TextInput                 | Import from @astryxdesign/core/TextInput; label/value/onChange(value,event), type=email/password/text, htmlName/autoComplete, isRequired, status. No generic root className/style; do not guess DOM props |
| Button                    | Import from core/Button; label, type=submit, isLoading/isDisabled. Prevent duplicate submission; use installed prop names                                                                                 |
| RadioList / RadioListItem | Both imported from core/RadioList; group label/value/onChange, child values client/photographer only                                                                                                      |
| Banner                    | Import from core/Banner; status/title. Color is not a live region; core/hooks useAnnounce announces transitions                                                                                           |
| Layout                    | core/Card, core/VStack, core/Heading with existing theme tokens; no added design system                                                                                                                   |

Result: [AUTH-S01](../../docs/features/auth/packet.md#auth-s01-signup--authsign-up) defines fields, initial/submitting/invalid/provider/network/confirmation states, focus/Enter/Tab behavior and navigation. Local state holds form input; SDK handles credentials/session, Query handles future API state. Vietnamese UI strings remain in the dedicated strings module. G1 blocks authoritative username reservation/initialization; G2 blocks exact password/callback/configuration behavior. Browser verification is planned at 375px/1280px with keyboard, labels, announcements and request/error checks; no form was rendered or passed.

## 2. Contract change

Prompt: "Read-only review: replace implicit GET /me initialization with an explicit onboarding API. Identify every affected layer; keep question #1 open."

| Layer                  | Inspected evidence and conditional impact                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API                    | Draft GET /v1/me permits initialization; changing side effects is a compatibility change. Proposed POST, read-only GET, 200/201 retry semantics and missing-profile reason need G1 acceptance                                                                        |
| Shared                 | index.ts exports roleSchema, registrationRoleSchema and healthResponseSchema only. Profile/error/onboarding schemas do not exist; future exports must follow the accepted wire contract                                                                              |
| ERD / migrations       | Account design is a draft; migrations contains .gitkeep only. No schema is claimed. Keep Auth IDs; later unique username/Auth-ID constraints implement accepted behavior                                                                                             |
| Permissions            | Derive caller from verified identity; metadata grants no authority. Deny other-user writes and invalid callers; ignore supplied server-controlled identity/role fields under the existing draft. Strict rejection would require an explicit accepted contract change |
| Browser                | Distinguish explicit missing-profile outcome from outage; resume after failed initialization; clear user cache on account changes. Existing health view is unaffected                                                                                                |
| Types / other services | Generated DB types wait for successful accepted migration replay. No Storage/Realtime/media/AI/Tauri behavior is introduced by onboarding                                                                                                                            |

Result: [packet inventory](../../docs/features/auth/packet.md#4-boundary-map-and-contract-inventory) and [ADR](../../docs/adr/0003-auth-profile-initialization.md) label every addition proposed. Tests are future scenarios, including normalized username races, same-user retries, response loss, unauthorized access, and private/public projections. No endpoint/shared/schema edit was made. G1 remains unresolved in both numbered decision tables.

## 3. Supabase migration

Prompt: "Plan a profile initialization migration for auth while ADR 0003 is Proposed. Read-only artifacts only."

Result: approval prerequisite is missing, so the output is conditional: after G1, use a new scoped migration for accepted account/photographer constraints, Auth references, deny-by-default RLS and required functions. Do not generate SQL, reset a database, or generate types during this exercise. G2 must settle confirmation enforcement; G4 reviews execution/access cases.

| Case to verify after approval                      | Expected invariant                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Anonymous / unverified caller                      | No private profile read or creation; email context is not identity                               |
| Verified owner                                     | Only self creation/read/edit under accepted API/DB rules                                         |
| Unrelated user / forged identity or metadata role  | No other-user private read/write or capability escalation                                        |
| Client / photographer / manually provisioned admin | Capabilities derive from data; no public admin grant or implicit cross-user admin power          |
| Two users race on normalized username              | Exactly one successful reservation; losing write has no partial profile                          |
| Same user repeats or loses response                | Exactly one own profile; retry reports existing values without renaming                          |
| Failure within profile transaction                 | Roll back all writes in that transaction; explicit-API alternative leaves Auth account resumable |

Local verification would deliberately check Docker/target, replay with `corepack pnpm db:reset`, run owner/other/anonymous cases using their actual identities (service-role-only checks cannot prove RLS), test transaction failures/races, and run `corepack pnpm db:types` only after successful replay. None ran: this task is artifact-only. Unavailable prerequisites must be recorded, never replaced by hosted execution.

## 4. Routing boundaries

Manual dry-run classification of the prompts using entrypoint routing plus each skill's description:

| Prompt                                                | Expected and reviewed routing                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| "Translate the remaining outline label"               | None: English documentation correction only                                                                  |
| "Explain React useEffect generally"                   | None: not a FrameRoom screen task                                                                            |
| "Plan the signup form layout; do not change behavior" | Astryx screen only; no SQL implementation or automatic contract rewrite                                      |
| "Review username validation/API compatibility"        | Contract change; migration skill only if concrete DB impact is part of the task                              |
| "Plan approved profile constraints and RLS"           | Supabase migration plus contract analysis where interfaces are affected; no screen skill without screen work |
| "Deploy this repository"                              | None of these three; hosting remains a separate deferred task                                                |

The routing outcomes above are consistent with the descriptions. Actual automatic selection depends on a future host/registration and is not tested here. No supporting executable script was needed by these exercises.

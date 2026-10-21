# FrameRoom: Week-one assignments and checklist

**Historical plan: Sprint 0.** Retained in English for context; unchecked items are original intentions, not current completion claims. The [current backlog](backlog.md), [foundation task](tasks/SETUP-001.md), and [contribution rules](../docs/contributing.md) supersede mandatory Jira, CI/staging, schema-freeze timing, and AI scheduling below. CI/CD, hosting, and AI implementation are currently deferred.

## 1. Original objectives

1. Set up repository/tooling, CI, local Supabase, and staging so the team can clone/run.
2. Review the existing contract_v0 draft into a full MVP v1: Khai/Khoa/Ly provide backend/frontend/database feedback.
3. Complete ERD v1 with Ly leading, Khai reviewing business/backend rules, and Quynh Anh reviewing use-case coverage; create migrations from the agreed contract.
4. Scaffold web/API and evaluate Astryx.
5. Do not implement AI Search/CV logic this week; agree only the search request/response outline, record terminology, and leave schema extension points.

Draft contract agreement may precede ERD completion, but official freeze requires Ly's contract/ERD reconciliation and reviewer confirmation that material mismatches are resolved.

## 2. Original role allocation

| Member                  | Primary                         | Support                          |
| ----------------------- | ------------------------------- | -------------------------------- |
| Nguyen Dang Khoi Nguyen | DevOps/CI-CD, docs              | Frontend, AI/QA docs             |
| Phan Le Dang Khoa       | Frontend                        | DevOps, frontend contract review |
| Ha Thao Ly              | Database, ERD, migrations       | API review                       |
| Le Quoc Khai            | Backend                         | API review, ERD support          |
| Dao Thi Quynh Anh       | QA, SRS/use cases, AI Search/CV | Docs, contract/ERD coverage      |

Nguyen owns repo/CI/Supabase/environment. Khai/Khoa/Ly review contract together. Ly leads ERD/migrations with Khai and Quynh Anh reviewing.

## 3. Original dependencies

1. Foundation and document review in parallel: Nguyen creates repo/workspace; Khoa scaffolds web; Khai scaffolds API; Nguyen integrates web/API CI.
2. Khai/Khoa/Ly review contract; Quynh Anh develops SRS/use cases/QA checks; agree draft v1 for FE/BE preparation.
3. Ly completes ERD from draft; Khai reviews booking/studio/photographer/states and Quynh Anh checks missing cases.
4. Ly reconciles contract/ERD, updates schema/migration; team reviews; Ly adds RLS/local migration; Nguyen adds staging/migration CI; Khai adds shared Zod schemas.
5. Freeze only after reconciliation.

Reuse valid draft content rather than rewriting it unnecessarily. ERD table/column/relation changes require endpoint review; API changes affecting storage require matching ERD/migration review.

## 4. Original individual tasks

Story points use the original 1/2/3/5/8 scale. Rows preserve original estimates and do not imply current commitments.

### Nguyen: DevOps/docs

| Task                                                                                           |  SP |
| ---------------------------------------------------------------------------------------------- | --: |
| GitHub repo, protected main/dev, PR/issue templates with API-impact question, invite team      |   2 |
| Discord channels and GitHub webhook                                                            |   1 |
| pnpm workspace, shared TS/ESLint/Prettier, Husky/commitlint, environment example, README/rules |   3 |
| API doc structure, endpoint template/index, API labels                                         |   2 |
| PR GitHub Actions install/lint/typecheck/build                                                 |   3 |
| Supabase staging, init/local guide, migration CI                                               |   3 |
| Web preview hosting with Khoa                                                                  |   2 |
| Verify team can clone/run                                                                      |   1 |
| SRS structure and role matrix with Quynh Anh                                                   |   2 |

### Khoa: Frontend / DevOps support

| Task                                                                                  |  SP |
| ------------------------------------------------------------------------------------- | --: |
| React 19/Vite/TypeScript/Astryx web scaffold with one working page                    |   2 |
| Web CI build with Nguyen                                                              |   2 |
| Review contract with Khai/Ly from FE perspective and agree draft v1                   |   3 |
| Review ERD screen-data coverage                                                       |   1 |
| Review data/pagination/loading/errors/uploads, Shoot Room/proofing/delivery with Khai |   3 |
| List screens and required data for contract comparison                                |   1 |
| Shared layout/routing and preview hosting with Nguyen                                 |   3 |
| Contract-example mocks for Sprint 1 endpoints                                         |   2 |

### Khai: Backend / database support

| Task                                                                                          |  SP |
| --------------------------------------------------------------------------------------------- | --: |
| Review contract with Khoa/Ly, propose changes, agree draft v1                                 |   3 |
| Review ERD states, studio/photographer relations, assignment/access with Ly                   |   3 |
| Fastify/TypeScript/Zod scaffold, environment validation, logger, common errors, health        |   3 |
| Review full backend feasibility: studio/services/schedule/resources/booking/brief transitions |   5 |
| API build/test CI, Supabase JWT middleware, me endpoint                                       |   3 |
| Initial shared Zod schemas and Swagger                                                        |   2 |

### Ly: Database / ERD lead

| Task                                                                                          |  SP |
| --------------------------------------------------------------------------------------------- | --: |
| Review contract completeness/data design with Khai/Khoa                                       |   3 |
| Complete full MVP ERD with Khai/Quynh Anh use-case review                                     |   8 |
| Agree naming, key types, timestamps, deletion, enums/lookups                                  |   1 |
| Reconcile every contract field with columns; identify gaps/unneeded columns/missing relations |   3 |
| Revise ERD and freeze after reconciliation                                                    |   2 |
| Core table/role/action RLS matrix matched to contract access                                  |   3 |
| First local migration: extensions, profiles, user_roles, has_role, portfolios; working reset  |   3 |

### Quynh Anh: QA / AI / docs support

| Task                                                                             |  SP |
| -------------------------------------------------------------------------------- | --: |
| SRS/main use cases and role matrix with Nguyen                                   |   5 |
| Review ERD/use-case coverage with Ly/Khai                                        |   3 |
| Review search shape, tags, reviews, reports/admin; identify missing requirements |   3 |
| Record photography terminology as encountered                                    |   1 |
| Review ERD AI extension points: tags/embeddings                                  |   1 |

Originally excluded this week: model benchmarks, image collection, and AI implementation.

## 5. Original API contract review

### 5.1 Coverage

Keep correct v0 content, clarify gaps, and extend toward full MVP v1.

| Group                                 | Coverage                                                             | Review status intended |
| ------------------------------------- | -------------------------------------------------------------------- | ---------------------- |
| Common rules                          | Base URL, JSON, pagination, errors, enums, updates                   | Re-review existing     |
| Accounts                              | me/roles; Auth signup/login directly from FE                         | Re-review existing     |
| Photographer/portfolio/images/Explore | Existing v0 resources                                                | Re-review existing     |
| Studio                                | Profiles/team/invitations/assignment                                 | Fill gaps              |
| Services                              | Photographer/studio packages and add-ons                             | Fill gaps              |
| Booking                               | Creation/brief versions/transitions and actors                       | Fill gaps              |
| Schedule/resources                    | Rooms/equipment/slots/overlap rules                                  | Fill gaps              |
| Shoot Room                            | Messages/decisions/milestones; API versus Realtime                   | Fill gaps              |
| Proofing/delivery                     | Galleries/previews/selections/notes/files; public versus signed URLs | Fill gaps              |
| Reviews/admin                         | Reviews/reports/moderation                                           | Fill gaps              |
| AI Search                             | Search shape, combined filters, match reasons                        | Shape only             |
| Dashboard/timeline                    | Endpoint/metric outline, additive details later                      | Outline                |

Excluded: payments, RAW, Tauri, AI Concept Studio, Community Rooms.

### 5.2 Per-endpoint requirements

Purpose/screens; role/ownership/membership access; request fields/constraints/JSON example; responses/errors; lifecycle states/actors for booking/brief/selection/delivery; explicit API versus direct Supabase/Storage/Realtime responsibilities.

Implemented shared Zod schemas remain the wire source of truth. Fix document/code mismatches in the same PR.

### 5.3 Original reviewers

| Area                              | Lead           | Review                                     |
| --------------------------------- | -------------- | ------------------------------------------ |
| Overall v1 draft                  | Khai/Khoa/Ly   | BE feasibility, FE data, DB/access mapping |
| Studio/services/schedule/booking  | Khai           | Khoa FE, Ly ERD/access                     |
| Room/proofing/delivery            | Khoa/Khai      | Ly schema/access, Quynh Anh cases          |
| Search/tags/reviews/reports/admin | Quynh Anh      | Khai BE, Khoa FE, Ly storage               |
| Contract/ERD reconciliation       | Ly             | Khai/Khoa/Quynh Anh                        |
| Open questions                    | Contract owner | Team review                                |

Agreement enables preparation; formal freeze follows ERD reconciliation.

### 5.4 Meaning of freeze

Freeze establishes endpoints/types/conventions/errors/access/state tables, not a permanent ban on changes. Additions use API-labeled PRs, team notification, and one reviewer. Breaking names/types/removals/access/states require Khai/Khoa, plus Ly for schema. Later groups may add detail. Schema impacts require ERD/migrations and related endpoint review together.

## 6. Original ERD entity checklist

- Accounts: profiles, user_roles.
- Providers/studios: photographers, studios, memberships, invitations.
- Services/portfolios: packages/add-ons/projects/images/tags/image_tags.
- Booking: bookings, briefs/versions/states.
- Schedule/resources: rooms/equipment/slots/exclusions.
- Collaboration: rooms/messages/decisions/milestones.
- Proofing/delivery: galleries/previews/selections/notes/deliveries.
- Reviews/admin: reviews/reports.

Embeddings are separate because dimensions depend on model selection; add later by migration. Review multi-studio membership, provider XOR, assignment authority, state storage, room access, booking/brief version relationships, gallery/delivery relationships, and overlap rules. Keep enum values/state names/length limits aligned with contract.

## 7. Original week-one checklist

### Team and tracking

- [ ] Kickoff: Definition of Done, Git rules, standups, rotating Sprint 0 Scrum Master.
- [ ] Read contribution rules; team has repository access.
- [ ] Confirm existing contract as review input.
- [ ] Create team-managed FR Scrum project and invite five members.
- [ ] Configure To Do -> In Progress -> In Review -> Testing -> Done.
- [ ] Enable story points; labels FE/BE/DB/AI/DevOps/Docs/API.
- [ ] Create epics E0–E11, Sprint 0 (12/10–25/10), Sprint 1; enter tasks/owners/estimates.
- [ ] Create ERD/contract review-and-freeze issues.
- [ ] Configure GitHub/Jira links and Discord notifications.

### Repository / CI

- [ ] GitHub/protected branches and PR/issue templates with API-impact field.
- [ ] Workspace/TS/ESLint/Prettier and Husky/commitlint.
- [ ] Environment example, README/rules, API docs/labels.
- [ ] Green GitHub Actions install/lint/typecheck/build.
- [ ] Discord channels/webhook.

### Supabase / database

- [ ] Staging project/access and local init/start.
- [ ] Naming/type rules agreed.
- [ ] Khai/Khoa/Ly agree contract draft.
- [ ] Ly completes ERD with Khai/Quynh Anh coverage review.
- [ ] Reconcile contract/ERD and freeze both after material gaps resolved.
- [ ] Core RLS matrix aligned to access.
- [ ] First reviewed migration into dev; local reset succeeds.

### Contract

- [ ] Common conventions reviewed across groups.
- [ ] Every endpoint has purpose/access/request/response/errors.
- [ ] Lifecycle states and transition actors defined.
- [ ] Search shape agreed, no implementation.
- [ ] Open decisions resolved or assigned an owner/time.
- [ ] FE/BE/DB/QA review complete.
- [ ] Freeze/change rules communicated after reconciliation.

### Frontend / backend / QA

- [ ] Web runs with Astryx, ADR, data requirements, layout/routing, preview hosting, mocks.
- [ ] API health, JWT middleware/me, shared schemas, Swagger.
- [ ] SRS/use cases, role matrix, coverage checklist, terminology/gaps.
- [ ] No model benchmarks or image collection this week.

### Original completion criteria

- [ ] Team can clone/run web/API.
- [ ] CI passes on PR; staging exists; local reset works.
- [ ] Reviewed/reconciled ERD and contract freeze with core RLS matrix.
- [ ] First migration merged into dev and verified locally.

These remain historical unchecked intentions. Current foundation uses local checks, optional Jira, no staging/CI/CD, and no business schema freeze.

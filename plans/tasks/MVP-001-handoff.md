# MVP-001 handoff

Branch: feature/MVP-001-ai-focused-workflow, based on the unmerged AGENT-001 branch.
The user requested a pull request targeting dev before the separate dark-interface
upgrade. This branch includes the inherited foundation/auth work as well as MVP-001;
reviewer approval is required before merging. No protected branch is pushed directly.
The user's untracked Introduction_to_Software_Engineering.pdf remains untouched.

## Implementation

English-default/Vietnamese UI, persistent language selection, Astryx localization,
Auth/onboarding, provider portfolios/services, Creative Projects and moodboards,
briefs, studio memberships/resources, atomic schedules/booking, Shoot Rooms,
proofing rounds, delivery, reviews and moderation are connected to real local
Supabase APIs and storage. Runtime models, worker jobs, spend reservation and
confirmation services implement the AI boundaries without mocked product responses.

Selected concept artifacts can be carried into the brief. The assistant uses one
primary image plus selected concept notes to keep requests bounded. Culling and
editing preserve originals and do not submit client selections automatically.

## Operating state

Local Docker/Supabase was started for verification. The development web/API and
worker were started from this workspace; restart after environment changes.
`pnpm demo:configure` wrote only ignored local connection settings to .env.
Synthetic accounts and licensed educational image references were seeded locally.

## Remaining release prerequisites

- Provision/configure a real Gateway key with a $30 cap and no automatic refills.
- Expand the 12-source-image demo seed to 100–200 permitted labeled images, index
  them, run the 30-query benchmark and review real briefs/concepts/edits/culling.
- Team review of the schema, API changes, UI and dependency additions before merge.
- Review the inherited foundation/auth changes together with this PR into dev.

These are not represented as passed or approved. See the verification record for
exact checks. Hosted rollout, CI/CD, desktop, RAW, payments and training remain out
of scope. Existing issued private URLs last up to five minutes after reassignment.

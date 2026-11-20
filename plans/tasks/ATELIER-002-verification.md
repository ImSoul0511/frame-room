# ATELIER-002 verification

Environment: isolated local Supabase `frameroom-atelier-verification`, API on
localhost:4000, web on localhost:5173. Synthetic accounts only. Original checkout
and other database projects are preserved.

## Executed evidence

- New migration applied non-destructively to the isolated database; generated
  TypeScript database types regenerated from that project.
- Unit/API checks cover verified-auth rejection before DB access, range validation,
  forged-owner input, target visibility, recipient-scoped marking, idempotent
  removal, CSV escaping/scope, and UTF-8 ICS escaping/folding/stable identifiers.
- `pnpm test:tools:db` uses real SQL, service functions and authenticated/anonymous
  database roles inside one rolled-back transaction. It checks owner/outsider RLS,
  denied direct writes/anonymous reads, hidden targets, repeat saves, calendar
  participant scope, private manager blocks, overnight overlap/exclusive ends,
  bulk-read isolation/retries and older unread records beyond the latest-100 window,
  agreed checklist import/retries, outsider and closed
  room denial, and invalid-item rollback without partial milestones.
- `tests/e2e/workflow-tools.spec.ts` exercises real sign-in, concurrent two-tab saves
  returning the same record, saved-provider refresh and removal, calendar month/agenda,
  a downloaded ICS file, keyboard day focus,
  printable agreed brief, print-only layout, notification triage and refresh.
- The complete client/manager journey also concurrently imports/retries the agreed checklist
  from both accounts (one creates two tasks; the other creates zero),
  checks task refresh, searches/filters two preview photos, and inspects a real
  downloaded selection CSV before submitting and delivering the booking.
- Responsive evidence is saved under `.artifacts/ATELIER-002-*` for 1280, 768 and
  375 pixels; calendar, brief, saved and notification screenshots were visually inspected. A print PDF
  is retained as a local QA artifact.

## Command results

- `pnpm check`: passed formatting, documentation links/translation scan, lint,
  TypeScript, 296 unit/API tests, and the production build. Vite retains its
  existing large-main-chunk advisory (about 928 kB minified); this is not a failed check.
- After preserving project context in the saved empty-state link, the affected web
  TypeScript and formatting checks passed again.
- `pnpm test:db`: 22 existing database workflow/RLS/role/conflict/budget checks passed.
- `pnpm test:tools:db`: five scenario groups passed; all fixture changes rolled back.
- `pnpm test:atelier:db`: workspace contracts, manager/profile reads, completion
  deadline/hold, automatic completion and migration-bridge checks passed.
- `git diff --check`: passed.
- `pnpm test:e2e`: all 11 browser tests passed in 49.5 seconds in the final
  sequential run, with no skipped tests.

Browser runs are performed after builds finish. Running the shared-package build
concurrently with browser tests caused transient API restarts and a Vite React
preamble error; that interrupted run is not counted as passing evidence.

## Limits

Cloud replay, Cloud RLS evidence and named database reviewers remain prerequisites
for merge/release under repository policy. No Cloud configuration was supplied.
Local evidence is supplemental. Paid AI was not configured or executed. This pack
does not require a new external service, AI provider, or deployment.

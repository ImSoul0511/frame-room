# ATELIER-001 verification

Status: In Review
Date: 2026-11-20

## Environment and provenance

- Baseline dev: fe38302. Original dirty checkout preserved separately.
- Baseline `pnpm check`: passed before implementation.
- Final checks use Node 22, pinned pnpm 9.15, installed Astryx 0.7 controls and
  Playwright Chromium. TextInput/Button APIs and installed component catalog were
  inspected; no component-library upgrades or initialization were performed.
- Supabase Cloud configuration was unavailable. A separately named disposable
  local project, `frameroom-atelier-verification`, uses ports 56321-56324.
- Existing FrameRoom and other local database projects were not reset. An initial
  check against the older FrameRoom schema failed on missing booking-event tables;
  its transaction rolled back. All subsequent database checks target the isolated
  project with the final migration set.
- The isolated worktree's ignored environment points to the verification project.
  The original environment was not changed. Synthetic accounts and permitted
  [photographic references](../../docs/product/atelier-assets.md) supply fixtures.

## Verification results

| Check                                            | Result            | Evidence                                                                                                                                                        |
| ------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh ordered migration replay                   | Passed locally    | Historical duplicate milestone column reproduced; compatibility bridge replayed successfully                                                                    |
| Database types                                   | Generated locally | Types regenerated from the disposable schema; Cloud type generation unrun                                                                                       |
| `pnpm test:db`                                   | Passed locally    | 22 workflow, RLS, role, conflict, stale-action and budget checks; transaction fixtures rolled back                                                              |
| `pnpm test:e2e`                                  | Passed locally    | Eight browser tests, including the real client/provider journey and concurrent project editing                                                                  |
| Supplemental completion/contract check           | Passed locally    | Three actual workspaces validated on the final run; real manager/profile reads, 168-hour deadline, hold/release, system completion and timestamp bridge checked |
| Final `pnpm check`                               | Passed            | Formatting, documentation, lint, type checks, 288 tests in 30 files and production build                                                                        |
| Cloud replay, RLS and cross-session verification | Blocked           | No Cloud project/configuration supplied                                                                                                                         |
| Paid AI execution and retrieval evaluation       | Not run           | No Gateway key or evaluation dataset configured                                                                                                                 |
| Named reviewer approval                          | Pending           | Required before merge; no protected branch merge or deployment performed                                                                                        |

## Browser scenarios

- Discovery filters and project context survive refresh/back navigation. Fault
  injection verifies retry after API failure and the unavailable visual-search state.
- English defaults correctly; Vietnamese switching persists and retains form input.
- Mobile menu supports keyboard activation. Legacy booking links retain their IDs
  and authentication return path.
- A client creates a project, uploads a real reference and reloads the persisted
  board. Provider selection carries that project into the guided booking request.
- A studio manager approves the brief, assigns a photographer/resource, confirms
  and starts the shoot, uploads a preview and opens selection.
- The client selects with the viewer's keyboard shortcut, closes with focus
  restored, compares two real previews, zooms, saves feedback and a keyboard-placed
  annotation, submits selection, receives files, confirms completion and reviews.
  An outsider cannot read that workspace.
- Two sessions edit one project. The stale write returns a conflict, retains its
  draft, displays the newer idea, and succeeds after explicit review. Successive
  brief saves advance their expected version and survive reload.
- Board and proofing screenshots were inspected at 375, 768 and 1280px. Document
  width remained within each viewport. Discovery previews had no browser errors.

The fresh replay repair, early wizard-submit regression, comparison selector label
and PostgreSQL enum-array response mismatch were corrected during verification.
Real manager studio listing, own photographer profile and service endpoints return
200; genre values are JSON arrays. No historical migration was edited.

The production build retains the baseline large-main-chunk warning (approximately
922 kB uncompressed / 266 kB gzip). The optional assistant is a separate lazy chunk;
the development simulator has no production route or emitted sandbox chunk.

Screenshots and traces are ignored under `.artifacts`, including
`ATELIER-001-board-*.png`, `ATELIER-001-proofing-*.png` and
`atelier-explore-*.png`. They are verification artifacts, not tracked source files.

## Reproduction

Run `pnpm check`. Configure one Supabase project consistently across browser/API,
apply the reviewed migration set and run `pnpm test:db` plus `pnpm test:e2e` with the
synthetic account settings described in the existing Cloud guide.

For the supplemental local check, use the explicitly named isolated project on
ports 56321/56322, set `FRAME_ROOM_E2E_LOCAL_PROJECT=frameroom-atelier-verification`
and the synthetic test accounts in ignored configuration, build shared, then run
`pnpm test:e2e` followed by `pnpm test:atelier:db`. This command refuses other
database ports/projects and requires a completed synthetic browser booking.

The full-story check distinguishes browser rendering, real client/API exchanges,
actual database transactions and the rendered responses. Fault-injection tests are
UI recovery evidence; they are not presented as database or real-AI evidence.

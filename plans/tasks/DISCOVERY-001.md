# DISCOVERY-001: Restore discovery pagination and refresh Explore

Status: Testing

## Scope and acceptance

Fix the collection-specific pagination label in photographer/studio lists. Keep loading subsequent pages while the pagination sentinel remains visible, stop automatic retries after failure, and preserve previously loaded results during recovery. Fetch initial Explore results immediately rather than waiting for visibility of the results container. Add a unique ID tie-breaker to SQL provider ranking so equal names/ratings cannot reorder between pages. No wire schema, database, or visibility policy changes.

Refresh `/explore` using the supplied cream and mauve dashboard reference: rounded panels, a sticky filter sidebar, pastel photographer cards, visible biography/location/genres, profile links, loaded-result count, and an end-of-results message. Preserve search/filter URLs, project context and bilingual copy. On mobile the panels stack and guest account controls occupy their own header row.

Existing Astryx `Action`/`Select` wrappers remain in use. CLI inspection confirmed `@astryxdesign/core/Button` (`label`, `variant`, `isLoading`, `isDisabled`) and `TextInput` APIs. Custom CSS covers the page layout and reference palette. Loading/error/retry use `QueryState`; empty and completion messages are announced. Names and profile actions are keyboard-accessible links.

## Verification

- Web and API TypeScript checks passed.
- Production web build passed; Vite reports the existing large entry chunk warning.
- Catalog route and Cloud catalog tests passed (74 tests).
- Browser regressions passed at 375px and 1280px: correct pagination labels, all pages retained, stationary sentinel, failed-page recovery, search, genre/reset, style mode and preserved project links. Existing collection pagination regressions also passed.
- Live read-only API verification returned 38 public photographers across four pages. Browser results matched all 38 IDs without duplicates. Screenshots in ignored `.artifacts/discovery-*` were inspected.
- Host Node is 24.11.1 rather than the declared Node 22; commands used `npm_config_engine_strict=false` without modifying repository settings. Vite/browser execution required the normal sandbox escalation for child processes.
- `git fetch origin --prune` could not write `.git/FETCH_HEAD` (read-only Git permissions). Existing work and branch were preserved; remote currency is unverified. No commit, push or deployment was performed.

Browser command: `FRAME_ROOM_E2E_CHANNEL=msedge pnpm exec playwright test tests/e2e/discovery.spec.ts tests/e2e/design.spec.ts --grep "photographers remain|stationary pagination|search, genre|live catalog|catalog cards"`.

Reviewer acceptance remains pending. This verifies current public catalog visibility, not the state of any particular hidden or unregistered photographer account.

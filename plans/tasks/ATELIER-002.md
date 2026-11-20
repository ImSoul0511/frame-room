# ATELIER-002: Shoot planning and review tools

Status: In Review
Owner: Codex
Branch: feature/ATELIER-001-product-upgrade
Worktree: D:/frame-room-atelier

## Outcome

Implement the user's approved follow-up pack on the Atelier interface: a shoot
calendar, calendar export, printable shoot briefs, saved providers, notification
triage, agreed-checklist import, and photo review search/filter/report tools.

## Behavior

- `/calendar` has a local-time month grid, keyboard day navigation, agenda, month
  picker, active/all status filters, and ICS download of the displayed 42-day range.
  Bookings overlap the range using exclusive end boundaries, including overnight
  shoots. Personal and managed-resource blocks are restricted to their owners.
- Heart controls persist private saved photographers/studios. `/saved` retains
  project context, supports genre filtering, and reuses the public discovery cards.
  Hidden/deleted targets do not appear in the API list or saved directory.
- `/bookings/:id/brief` prints the agreed version, or the latest draft when no
  agreement exists. Native print/save-PDF uses a dedicated A4 stylesheet. No chat
  history or signed image links enter the document.
- Notifications offer server-side all/unread/read filters, a mailbox-wide unread
  count, contextual links, individual marking, and recipient-scoped bulk read.
  Each view shows its most recent 100 records; older unread items remain reachable
  through the unread view and included in bulk marking and counts.
- An open shoot room can import the currently agreed checklist into milestones.
  The existing booking/room lock serializes imports and manual task changes.
  Trimmed duplicate/existing titles are skipped; all titles are validated before
  insertion. Any invalid title leaves the room unchanged. Existing milestone
  limits (120 characters) remain in force.
- Photo contact sheets filter selected/unselected/current-round feedback, search
  filenames/frame numbers, and download CSV reports of selected frames with only
  currently visible feedback. Reports preserve origin labels and exclude image
  URLs. Spreadsheet formula prefixes are escaped.
- New strings are supplied in English and Vietnamese. Existing lifecycle, role,
  identity, booking agreement, selection history, and storage rules are reused.

## Contract impact

| Layer            | Implementation                                                                                                           | Compatibility                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Shared           | Saved-provider, calendar/range, changed-count schemas                                                                    | Additive exports                                    |
| API              | Verified-account planning endpoints and typed notification reads in `workflow-tools` module                              | Existing routes retained; standard envelopes/errors |
| Database         | `20261120000700_saved_providers.sql`                                                                                     | New UUIDv7 table; no merged migration changes       |
| Access           | Own-row authenticated SELECT, API-mediated saved writes; explicit actor predicates and existing booking/provider helpers | Saving grants no booking/media access               |
| Transactions     | Atomic bulk read, upsert saves, locked checklist import                                                                  | Duplicate retry safe                                |
| Browser          | Three protected pages; contact-sheet and notification enhancements                                                       | Existing links and booking/project context retained |
| Storage/Realtime | No new buckets, publications, or channels                                                                                | Existing refresh/invalidation covers workspaces     |

Migration indexes cover owner listing and target foreign keys; one-target CHECK
and per-user target uniqueness prevent invalid/double saves. Generated database
types include the new table. Apply the additive migration before exposing saved
provider actions. Rollback can hide the new actions while retaining saved data;
do not drop the table as an application rollback.

## Verification and remaining prerequisites

See [verification](ATELIER-002-verification.md). The user confirmed no Cloud
configuration is available. Database execution uses only the explicitly isolated
`frameroom-atelier-verification` local project; it does not satisfy Cloud replay or
named database review requirements. No hosted project or paid model is used.

# BOOKING-002 implementation plan

The [Vietnamese product plan](../../report/BOOKING-002-plan-vi.md) records the agreed requirements, page permissions, genre defaults, delivery sequence, migration strategy and acceptance scenarios.

1. Unify public user names, typography and discovery colors. Show descriptions in public albums and preserve the aspect ratios of portfolio images in a compact masonry layout.
2. Use the same Vietnam locality identifiers for provider onboarding and bilingual discovery. Support multiple style tags throughout search and pagination.
3. Allow a verified customer to create and manage a studio. Base project access on the current booking participants. Add public availability and preserve conversations across bookings.
4. Price services by unit and quantity. Accept a versioned private quote directly from a conversation. Both parties must approve a scheduled interval before confirmation.
5. Support multiple studio photographers, reserve calendars atomically and record who actually performed the shoot.
6. Apply proofing rules from the agreed package, support original deliverables including RAW and ZIP, and attribute each studio review to the studio and every actual participant.

Image-based provider search is deferred. Open storage limits and proposed defaults for add-ons, style matching and attendance are recorded in the product plan.

## Implementation and rollout

The migration series `20261126000100` through `20261126000600` adds quote pricing, team assignments, attendance, proofing rounds, original media, public availability, canonical localities and actionable room decisions. The API and the web depend on this series for the new flows. Apply the migrations in order in a disposable Supabase project before deploying the web.

| Area           | Defaults and compatibility                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pricing        | Add-ons are charged once per booking. Photo and retouch quotas multiply by quantity. Revision limits apply to the entire booking. Bookings keep a snapshot of the agreed terms.                                                               |
| Discovery      | A style match can satisfy any selected tag. Existing single-tag links still work. Public display names follow the account profile. Locality names from prior records map to a stable locality ID when recognized.                             |
| Availability   | New calendars are private. Public calendars show two-hour slots between 09:00 and 17:00 Vietnam time for the next seven days. The reservation check remains authoritative at confirmation.                                                    |
| Studio reviews | A current manager confirms attendance. The studio and each photographer recorded as attending receive credit for the same review. Booking permissions follow current assignments. Previously signed download links expire after five minutes. |
| Delivery       | The provisional file limit is 50 MiB per file. Larger supported files use signed resumable requests in the same browser session. Existing WebP deliveries remain readable.                                                                    |

PostgreSQL replay, simultaneous reservation, Storage permissions and RAW/ZIP transfer verification require a designated Supabase test project. Type generation follows successful schema replay. Check a legacy booking, a private quote used by two concurrent requests, a studio replacement with overlapping reservations, and an interrupted original upload during that replay.

## Local verification

- TypeScript checks passed for shared, web and API code. ESLint, Markdown checks and the production web build passed. Vite reports the existing bundle-size warning.
- Vitest passed 290 tests in 31 files. Booking route tests cover quantity multiplication, one-off add-ons and the use of a private quote without a catalog service.
- Edge passed discovery coverage at 375 px and 1280 px, including pagination, retry and multiple style tags with mocked data.
- Edge passed the authenticated profile flow with fixture data, including dragging the cover crop at mobile width for both Customer and Photographer accounts.

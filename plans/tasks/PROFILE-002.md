# PROFILE-002: Use the photo dropdown for cover images

Status: Testing

## Goal and acceptance criteria

Use the existing avatar dropdown interaction for covers on client and photographer profiles. Both photo controls offer View and Choose actions. Opening the cover dropdown must not open an empty edit dialog. View is disabled without an image; existing covers, including the photographer's portfolio fallback, open in a viewer. Choosing a cover opens the file picker and then the existing preview/save dialog. Keep avatar cropping and upload validation intact.

## Implementation

`PhotoEditButton` shares its native popover, positioning, file picker and viewer between avatars and covers. The menu uses existing styling, dismisses with Escape or an outside click, and stays within the viewport. `AccountPage` supplies each profile's current cover URL. English and Vietnamese dictionaries own the cover-view label. Existing API and storage contracts are unchanged.

## Verification

Environment: Windows, Node 22.19.0, pnpm 9.15.0, installed Edge. The existing profile browser regression now covers cover menus at 375px and 1280px for both profile roles, no-cover and existing-cover states, Escape/focus return, opening the current cover, choosing a replacement, preview and cancel, and avatar viewing/cropping. Auth and API requests use isolated fixtures; no real account writes occur.

| Check                      | Status | Evidence                                                                                             |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Web TypeScript             | Passed | `pnpm --filter web typecheck`                                                                        |
| Production build           | Passed | `pnpm --filter web build`                                                                            |
| Profile browser regression | Passed | `FRAME_ROOM_E2E_CHANNEL=msedge pnpm test:e2e tests/e2e/header.spec.ts --grep "avatar opens profile"` |

The browser regression passed (1 test). The cover menu screenshots were visually reviewed on mobile and desktop; menus have readable single-line actions and remain inside the viewport. Screenshots are ignored artifacts at `.artifacts/cover-dropdown-{client,photographer}-{375,1280}.png`. Real storage writes are unchanged and outside this menu verification. Reviewer approval remains pending.

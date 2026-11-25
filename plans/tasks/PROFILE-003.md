# PROFILE-003: Place the cover above account identity

Status: Testing

## Goal and scope

Display the cover as a full-width banner above the avatar and name on client and photographer account profiles. The cover must not sit alongside or behind the avatar. Preserve the photo dropdown interactions and the existing profile content.

## Implementation and acceptance

The account portrait uses one grid column with a cover row followed by an identity row at every screen size. Cover height responds to the content width; custom and portfolio fallback images fill the banner. The avatar stays entirely below the cover. No API, data or permission changes.

The existing profile regression checks banner width, identity/avatar separation and page overflow at 375px and 1280px for both profile types, then exercises their cover menus. Cropped portrait screenshots are stored in ignored `.artifacts/profile-banner-{client,photographer}-{375,1280}.png`.

## Verification

| Check                      | Status | Evidence                                                                                             |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Production build           | Passed | `pnpm --filter web build`                                                                            |
| Profile browser regression | Passed | `FRAME_ROOM_E2E_CHANNEL=msedge pnpm test:e2e tests/e2e/header.spec.ts --grep "avatar opens profile"` |

Browser requests use isolated Auth/API fixtures. Actual storage writes and reviewer approval are outside this visual layout verification.

The production build completed and the profile browser regression passed (1 test, 43.1 seconds total). Desktop and mobile portrait screenshots were visually reviewed. The cover spans the portrait width and the avatar and name sit entirely beneath it.

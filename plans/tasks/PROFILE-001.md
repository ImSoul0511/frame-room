# PROFILE-001: Make account settings directly editable

Status: Testing

## Goal and scope

Allow clients and photographers to edit their display name and username directly in Settings. Replace the locked fields and ambiguous Update/Confirm flow with Save changes and Cancel. Give the sign-in email its own labeled section. Preserve existing avatar, password, language and photographer settings.

## Dependencies and contract impacts

Uses the implemented authenticated `PATCH /v1/me`, `profileInputSchema`, and existing profile query cache. No API, permission, shared schema, or database changes.

The installed Astryx CLI catalog and TextInput/Button documentation were inspected. Existing `Field` and `Action` wrappers use `@astryxdesign/core/TextInput` (`description`, `status`, `autoComplete`, `isDisabled`, `isRequired`) and `@astryxdesign/core/Button` (`type`, `variant`, `isLoading`, `isDisabled`). Layout reuses existing panels and styles.

## Acceptance criteria

- Both names are editable on entry, with current values and translated hints.
- Saving requires a meaningful change and valid shared-schema input.
- Cancel restores the last successful values without sending a request.
- Pending requests disable duplicate writes; success is shown only after the response.
- Username conflicts identify the field; request failures retain input for retry.
- Labels, keyboard submission and responsive layout work at 375px and 1280px.
- Sign-in email has a clear label outside the editable profile form.

## Verification

Environment: Windows, Node 22.19.0, pnpm 9.15.0; existing working tree preserved.

| Check                         | Status | Evidence                                                                                                                                                        |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter web typecheck` | Passed | TypeScript completed without errors.                                                                                                                            |
| `pnpm --filter web build`     | Passed | Vite production build completed; existing large-chunk warning remains.                                                                                          |
| Profile browser regression    | Passed | `FRAME_ROOM_E2E_CHANNEL=msedge pnpm test:e2e tests/e2e/header.spec.ts --grep "avatar opens profile"`. Uses isolated Auth/API fixtures; no real account changes. |

Browser scenarios passed for direct editing, cancel, invalid display names and usernames, duplicate usernames, failed writes and retry, delayed success, Enter submission, persisted values after reload, avatar controls and mobile overflow. Screenshots are ignored artifacts at `.artifacts/profile-settings-375.png` and `.artifacts/profile-settings-1280.png`.

Git fetch could not update `.git/FETCH_HEAD` because the workspace makes Git metadata read-only. No branch, commit or push was performed. Real authenticated API/database writes and reviewer approval remain outside this local UI verification.

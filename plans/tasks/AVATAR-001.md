# AVATAR-001: User avatar upload and editing

## Checklist

- [x] Inspect profile schema, upload service and current avatar display.
- [x] Add an authenticated API to save or clear an owned uploaded avatar, with storage validation.
- [x] Return avatar information from the profile API in both database and Cloud adapter modes.
- [x] Add upload, preview, save and removal controls with error and loading states.
- [x] Display the saved avatar with initials as a fallback in account, search and direct messages.
- [x] Update API documentation and cover ownership and existing profile behavior in mocked tests.
- [x] Run focused tests, type checks and lint; record verification limits.
- [ ] Verify the upload, display and keyboard interactions in a browser with a designated test account.

## Impact

| Layer    | Change                                                                       | Compatibility                                      |
| -------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Storage  | Reuse `avatars` bucket and user-prefixed WebP uploads.                       | No bucket changes.                                 |
| Database | Reuse `profiles.avatar_path`.                                                | No migration; existing paths remain valid.         |
| API      | Add avatar update and return avatar path with the existing profile.          | Existing profile edit payloads remain unchanged.   |
| UI       | Preview, update or remove the current user's avatar, with fallback initials. | Existing users without an avatar continue to work. |

Cloud database content will not be changed during verification. API changes need the normal review in [contributing](../../docs/contributing.md#commits-and-prs).

## Verification

API and web type checks and targeted ESLint passed. Three mocked test files passed
(29 tests), including avatar path ownership, clearing an avatar and upload regression.
The Cloud adapter and browser interaction were not exercised against a live account.
Uploads remain in the public bucket when a profile reference is replaced or cleared;
automatic cleanup is not implemented.

# MSG-001: Messenger-style direct chat

Status: In Review

## Scope

Refresh `/messages` with a conversation list, focused thread view, participant
initials, message bubbles, and a compact composer. Keep existing API, attachment,
realtime, and optimistic-send behavior.

## Progress

- [x] Add shared two-letter user initials and use them in chat, account, and people search.
- [x] Add desktop conversation-list and message-thread layout.
- [x] Add mobile thread navigation and responsive composer.
- [x] Send with Enter while preserving newlines with Shift+Enter.
- [x] Keep newest-message scroll behavior while preserving position when loading older messages.
- [x] Add matching English and Vietnamese interface strings.
- [x] Keep this change in frontend code; no database writes or schema changes.
- [ ] Verify appearance and keyboard interaction in a browser at 375px and 1280px.

## Data dependency

The conversation API currently supplies participant names but no avatar URL. The
interface therefore uses generated initials as the default avatar for every
participant. Showing uploaded profile photos requires the API to expose an approved
avatar URL in a later change.

## Verification

Not run. Browser and automated checks were not requested for this UI change.

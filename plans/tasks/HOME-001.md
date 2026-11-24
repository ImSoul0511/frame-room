# HOME-001: Home and discovery redesign

Status: In Review

## Goal and scope

Implement the user's supplied visual direction in the existing React application.
Retain API endpoints, authentication, booking and project behavior.

## Acceptance criteria

- Use #fdfaf3 paper and Imperial Script Regular section titles.
- Preserve the original #afb4ce outer frame and page shadow; the paper colour
  applies inside the frame.
- Refine the two upper leaf sprays against the user's cropped reference: five
  elongated, asymmetric leaves from one fine-stemmed base, translucent sage
  watercolor layers, uneven delicate gold contours and a few lavender flecks.
- Retain the flower animation; add sage/gold upper branches, lower flowers,
  stronger watercolor patches and a smaller bottom fade.
- Home replaces the old Explore presentation. Primary navigation contains Home,
  Explore (photographers/studios), Genres (the twelve shared portfolio genres), About us.
- Replace introductory stories, the Shoot Brief promotion and the Home collection
  with a clipped aperture ring: slow autonomous rotation, scroll response,
  focused genre, adjacent previews, accessible controls and genre destination links.
- Genre pages scope primary genre to the route, retaining secondary tag/search/sort/pagination.
- Public provider directories show actual recent portfolio imagery and provider metadata;
  studio cards are wider than photographer cards.
- Avatar opens Profile directly. Account workspace links live inside Profile;
  messaging has a floating bottom-right launcher with unread indication.
- Check responsive layouts, motion preferences, keyboard behavior, types and builds.
- Hide the complete header (masthead and navigation) on downward page scroll;
  reveal it on upward scroll, near the top and during keyboard/menu interaction.
- Keep the original aperture rim and six blade shapes. Follow the latest supplied
  composition with watercolor blade fills, fine gold contours, botanical sprays
  around the rim and a richer centre wash with soft light points, with no centre text.
- Support pointer dragging and independent movement inside the core. Present
  one or two photos per genre, neighbouring editorial previews and a separate
  Explore action; all interface labels follow the selected language.

## Contract impacts

None. Public discovery uses the implemented photographer, studio, portfolio and tag APIs.
Authenticated workspace paths and role checks remain in place.

## Implementation notes

Use existing Astryx Action/Field/Select wrappers for controls. Custom SVG and
editorial layout cover the aperture/illustration gap. CLI inspected TextInput,
Button and DropdownMenu; navigation uses semantic links/disclosures rather than
an action menu. Content remains in matching English/Vietnamese dictionaries.

Home keeps the existing `/explore` URL, with `/home` as an alias. Public directories
use `/photographers` and `/studios`; genre collections use `/genres/:genre`.
The project query parameter survives navigation into discovery and provider profiles.
Motion uses requestAnimationFrame with eased scroll response, a twenty-second
turn per genre, circular pointer dragging, shortest-path manual selection,
focus/pause controls and reduced-motion support. The core colour wash moves
independently behind a clip that follows the central opening; the rim and blades
retain their original geometry with layered watercolor fills. SVG botanical sprays,
soft pigment edges, a selected-genre star and curved rotation cues decorate the rim.
The photo composition uses a large paper frame with a smaller tilted print overlapping
its lower corner, with botanical accents and a separate Explore action. A subtle
procedural SVG grain supplies the paper texture. The supplied screenshot is a
composition reference only; no screenshot or cropped reference image is used in the UI.
Optional inspiration imagery prefers published portfolio covers; fallback photographs
are identified as genre inspiration and are not presented as provider work.

Imperial Script Regular is served locally from `apps/web/public/fonts/` with its
[SIL Open Font License](../../apps/web/public/fonts/OFL.txt).
Source: [Google Fonts](https://github.com/google/fonts/tree/main/ofl/imperialscript),
retrieved 2026-11-24. Reference photo URLs are recorded in
`apps/web/src/features/catalog/genre-art.ts` (Unsplash; existing demo source plus
drink, graduation and landscape references). No attached stock image was copied.

## Verification

Node 22.13.0 was selected through fnm instead of the host-default Node 24.
Git refs fetched successfully; work is on feature/HOME-001-discovery-redesign.

- Passed: repository formatting check, ESLint, workspace TypeScript, workspace
  production build, and all 270 existing Vitest tests across 27 files.
- Passed: `git diff --check` and HTTP 200 for the local Home preview.
- Live public API checks: Portrait returned four portfolios, all with matching
  primary genre and cover URLs. One portfolio returned seven images; its provider
  detail returned two portfolios, both with covers. The studios endpoint returned
  an empty list, so a populated studio directory still needs visual review.
- `pnpm check` stops at the pre-existing documentation language scan failures in
  `docs/backend/backend-database-remediation-plan.md` and
  `docs/backend/endpoint-schema-audit.md`. Those files were not changed. Remaining
  checks were run individually.
- Browser QA blocked: Chrome attachment reports that it requires a network policy
  and a Codex desktop update; the in-app browser is unavailable. No screenshot,
  375px/1280px visual review, keyboard interaction, authenticated profile/chat
  interaction, or live motion verification is claimed.
- The production build retains the existing large-entry-chunk warning.
- Leaf refinement (2026-11-25): replaced the solid five-path spray with separate
  slender leaf silhouettes, translucent pigment layers, shared watercolor patches
  and lightly displaced gold contours. Reviewed standalone renders of the actual
  SVG component at 780px and 390px. Web typecheck, lint for both affected
  components, production build and `git diff --check` passed. This does not
  replace the full-page browser review listed above.
- Scroll header (2026-11-25): grouped masthead/navigation into a sticky header
  with a 240ms transform transition. A passive, animation-frame-throttled listener
  hides it after 12px of downward travel and reveals it on upward travel. It
  stays visible near the top, while a control has focus or a menu is open, and in
  the fixed messaging layout. Route changes restore visibility. Web typecheck,
  lint for both affected components, production build and `git diff --check`
  passed. Live browser scroll verification remains pending.
- Aperture refinement (2026-11-25): restored the original rim/blades and restricted
  the colour accent to the central opening. Removed centre lettering, reduced
  the desktop circle diameter, added pointer capture/dragging with continuous
  angle handling across 360 degrees and independent core movement. Each genre
  uses up to two published portfolio photos with adjacent image previews and a
  separate localized Explore action. Vietnamese navigation now uses Vietnamese
  labels; user-authored portfolio content and the user's genre label edits are
  preserved. Web typecheck, changed-file ESLint, production build and eight focused
  geometry/locale tests passed. Standalone full/half SVG renders were reviewed. Browser attachment
  still fails on the desktop client's network-policy requirement; live dragging
  and full responsive composition remain unverified in a browser.
- Reference styling (2026-11-25): added coded SVG botanical sprays and watercolor
  blade/paper textures, a rim ornament with star/rotation cues, soft central bokeh
  and paper/polaroid photo frames. Reviewed full and clipped standalone SVG renders
  of the actual components. The one/two-photo limit, API integration, drag math,
  reduced-motion preference and existing language/genre edits are preserved.
  Changed-component ESLint, web TypeScript and production build passed. Full-page
  browser visual verification remains pending.

Manual follow-up: run `pnpm dev`, inspect Home at 1280px and 375px, scroll the
aperture section, test direct genre selection/pause/reduced motion, navigate both
dropdowns with the keyboard, and verify avatar/workspace/chat under each existing
account role. Source changes are local and uncommitted; no PR or deployment was
created.

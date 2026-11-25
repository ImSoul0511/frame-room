# PROFILE-004: Default photographer covers and image-only galleries

Status: Testing

## Behavior

Photographer profiles use only the explicitly saved profile cover. Without one, the existing FrameRoom default banner appears even when the photographer has published albums. The same rule applies to the account overview and its cover viewer. Failed custom cover loads also return to the default banner. This supersedes the portfolio fallback described in PROFILE-003; no stored media or API contracts change.

Shared album/photo cards now contain only the image. Captions appear in a gradient overlay along the bottom edge on pointer hover or keyboard focus. Titles remain accessible names for album links; descriptions are associated using `aria-describedby`. Tags, credits, provenance badges and permanent text blocks are removed from image displays. Images keep their original proportions and are capped at 280px in grids. This applies to Explore, genre results, provider albums and album photos.

The lightbox uses the same hidden bottom caption. Navigation, image reporting and owner tag editing remain available inside the viewer. Album edit links still open the existing editor. Data and upload/tag-edit inputs are preserved.

## Implementation and checks

The existing FrameRoom screen skill and previously inspected Astryx wrappers remain applicable. Custom CSS implements the image overlay, which is not an Astryx form component. Existing default, loading, unavailable-image, cover-upload, and gallery navigation states are retained.

- Web TypeScript and production build passed; the existing large bundle warning remains.
- Six targeted browser checks passed: desktop/mobile compact captions, keyboard focus, pagination/project context, real catalog image sizing, and existing account/cover menu interactions.
- Additional cover regression checks cover account and public profiles with published albums but no custom cover, plus broken custom cover URLs.
- Inspected `.artifacts/compact-caption-{1280,375}.png` and `.artifacts/default-cover-{1280,375}.png`. Captions sit within the image's lower edge; default banners contain no album image.

Commands used `npm_config_engine_strict=false` because the host runs Node 24 instead of the declared Node 22. Browser commands used `FRAME_ROOM_E2E_CHANNEL=msedge` and normal sandbox escalation for child processes. No account writes, deployment, commit or push were performed. Reviewer acceptance remains pending.

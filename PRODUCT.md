# otpravkarr product context

Self-service IPTV access for accepted Plex friends, backed by Dispatcharr with subscriber and owner surfaces.

## Platform

web

## Users

Subscriber shell: sticky top header otpravkarr, My access, My channels, Setup guide, Alex, Sign out; no sidebar and no admin links. Signed-out landing has a small wordmark and no authenticated nav. Admin shell: 224px sidebar Overview, Users, Settings, Plugins, Audit log.

## Primary tasks

- **Visitor:** Subscriber landing and sign-in. Proposed route: `/`.
- **Subscriber:** Subscriber access dashboard. Proposed route: `/portal`.
- **Subscriber:** Channel choices. Proposed route: `/portal/channels`.
- **Subscriber:** Desktop and TV setup guide. Proposed route: `/portal/setup`.
- **Admin:** Owner admin overview. Proposed route: `/admin`.
- **Admin:** Subscriber administration. Proposed route: `/admin/users`.
- **Admin:** Connections and sync settings. Proposed route: `/admin/settings/connections`.
- **Admin:** Lineup policy and security settings. Proposed route: `/admin/settings/lineup`.

## Product requirements

- Name always lowercase otpravkarr. Plex accepted friendship grants access; pending friendship does not.
- Credentials masked until revealed. QR code generated only when Show QR code is pressed.
- Streams and guide come from Dispatcharr. No embedded video player or programme guide.
- Core channels are included under core-plus-bundles; zero approved groups means zero channels.
- Downloaded M3U is a snapshot and does not update automatically. Owner and subscriber sessions are separate.

## Confirmed visual direction

Dark Matter. Warm orange against dark plum, generous editorial serif headings, restrained grain only on landing, translucent sticky subscriber header. Operational pages flat; one quiet photographic crop on landing only. The selected direction is confirmed; these expanded layouts and exact token values are a proposed design seed for review.

## Accessibility and inclusion

Keyboard access throughout, visible focus, labelled inputs, text plus icon for status, 44px touch targets, readable text at 200% zoom, and reduced-motion alternatives. Target WCAG AA text contrast. Never use color alone to communicate a decision. Bundle fonts locally in the implementation.

## Product source and rewrite proposals

Read [the legacy product specification](docs/product/legacy-spec.md) for domain behavior and current gaps. Routes in this handoff describe proposed information architecture, not implemented endpoints.

The new direction changes the interface; preserve the original specification's authorization and lifecycle behavior.

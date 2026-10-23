# otpravkarr product context

<!-- impeccable:product-schema 1 -->

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

## Positioning

- otpravkarr is a small bridge between one Plex server owner's existing circle of friends and that owner's Dispatcharr. It is not a multi-tenant or commercial IPTV panel: there is no sign-up, pricing or purchase, and no access for anyone outside the owner's accepted Plex friends.
- The alternative it replaces is the owner creating Dispatcharr accounts by hand, handing out passwords and remembering to delete them.
- The mechanism a neighbouring tool can't truthfully claim: the owner's Plex friends list is the identity and entitlement source. An accepted friend gets their own scoped Dispatcharr account the first time they sign in with Plex, and losing the friendship removes access, without the owner creating, handing out or deleting accounts by hand.
- Scoping is enforced inside Dispatcharr itself, through the Dispatcharr channel profiles assigned to each subscriber's account, at stream time, so a subscriber's channel limit holds in their player and not only in the portal. otpravkarr's own playlist filtering is information hygiene, not the boundary.
- Subscribers never need Dispatcharr itself. Everything they can see or change is in otpravkarr, inside the limits the owner sets there, and the owner controls those limits finely: which channel groups and bundles each person gets or may pick, and whether movies, series, catch-up or adult content are on (D21, D22).
- It stays narrow on purpose: Dispatcharr and its plugins own channels, groups, guide data and video; otpravkarr owns who gets an account, which channel groups that account can see and which kinds of content are on for it.

## Operating Context

- **Scale and shape.** One self-hosted instance for one owner and tens (not thousands) of subscribers, against a Dispatcharr catalogue of hundreds to a few thousand channels and up to around a thousand groups. It runs as one process in one container on one port, with container packaging in the separate `otpravkarr-docker` repository; horizontal scaling is an accepted limit, not a goal.
- **Upstream systems.** Plex (plex.tv account services and the owner's Plex Media Server) for sign-in, identity and the friends list; nothing is written to Plex. Dispatcharr for users, channel profiles, channel groups, the guide and streams, plus the Dispatcharr plugins installed there, which may rename, regroup, quarantine or hide channels on their own schedules.
- **Downstream.** The subscriber's own IPTV player apps, fed with Dispatcharr's playlist, player-API and guide URLs. The setup guide recommends free and open-source players only, computers first: [Open TV](https://github.com/Fredolx/open-tv) (shipped as Fred.TV; Windows, macOS, Linux), [IINA](https://iina.io/) (macOS) and [VLC](https://www.videolan.org/vlc/) (every platform, phones and TVs included). Other Xtream-Codes-capable players should work with the same URLs, but none is verified yet.
- **Network placement.** Typically on the same private network as Dispatcharr and behind the operator's reverse proxy. The operator controls the host, the proxy and Dispatcharr; Dispatcharr's public ingress is the operator's concern, outside the app.
- **Subscriber ritual.** Sign in with Plex once; copy the playlist, player-API and guide URLs (or show a QR code on request) into a player; come back occasionally to change channel bundles or groups where policy allows, refresh credentials, or re-download a playlist snapshot.
- **Owner ritual.** A one-time first-run setup that connects Plex and Dispatcharr; then occasional visits to the admin console to check Plex, Dispatcharr and database health, run a sync by hand, manage subscribers, review the audit log, and set lineup policy and bundles. A background sync on an interval (15 minutes by default in the legacy app) keeps Plex friendships, local records and Dispatcharr accounts converged in between.
- **Language.** The legacy app was British English only with en-GB dates, and one portal string assumed a Danish core lineup from the original deployment. The rewrite is translatable (D28): British English, the default, and Danish, with dates and numbers formatted for each viewer's locale. Lineup wording comes from the owner's own configuration, never from a hard-coded lineup.
- **Rewrite state.** The rewrite has only its ground floor (an empty SvelteKit app with `/healthz`); routes in this file are proposed information architecture, not implemented endpoints.

## Product requirements

- Name always lowercase otpravkarr. Plex accepted friendship grants access; pending friendship does not.
- Credentials masked until revealed. QR code generated only when Show QR code is pressed.
- Streams and guide come from Dispatcharr. No embedded video player or programme guide.
- Core channels are included under core-plus-bundles; zero approved groups means zero channels.
- Downloaded M3U is a snapshot and does not update automatically. Owner and subscriber sessions are separate.

## Confirmed visual direction

Dark Matter. Warm orange against dark plum, generous editorial serif headings, restrained grain only on landing, translucent sticky subscriber header. Operational pages flat; one quiet photographic crop on landing only. The selected direction is confirmed; these expanded layouts and exact token values are a proposed design seed for review.

## Evidence on Hand

**On hand:**

- `docs/product/legacy-spec.md`: the imported specification of the shipped v1 app (behaviour, domain model, integrations, security, glossary and its §12 known weaknesses). It records that v1 was in production use for the original deployment. Its technology and deployment sections are superseded, and it drains to deletion as module specs cover it.
- `legacy-old/v1` branch: the previous code, for reference only; nothing is brought over from it.
- `docs/research/dispatcharr.md`: research against Dispatcharr v0.32.0 (sources read 2026-10-18), including where current Dispatcharr behaviour differs from the legacy spec. The owner has reviewed it, and its candidate decisions are now D19–D26.
- `docs/decisions.md`: the decided and open `D<n>` entries for the stack and the Dispatcharr access model.
- `docs/SPEC.md`: the built ground-floor spec; the capability map is still a placeholder.
- `docs/design/screens/01-landing.webp` to `docs/design/screens/10-recovery-and-components.webp` and `docs/design/references/dark-matter.webp`: generated raster mockups and the selected direction reference. Their body text, numbers and icons are illustrative, not specification.
- `.impeccable/surfaces/*.md`: eight route briefs (`/`, `/portal`, `/portal/channels`, `/portal/setup`, `/admin`, `/admin/users`, `/admin/settings/connections`, `/admin/settings/lineup`), all marked as a proposed design seed for review.
- `DESIGN.md` and `panda.config.ts`: the proposed Dark Matter design seed and its tokens.
- `tests/fixtures/demo-fixtures.json`: a fictional fixture (snapshot date 2025-10-15: 42 users, 38 active, 4 inactive, four demo bundles with channel counts). The people in the briefs (Alex, Jordan, Morgan) and the `*.example` addresses are placeholders.
- `static/otpravkarr-icon.svg`: the product icon. `LICENSE`: AGPL-3.0.

**Not on hand (never fabricate):**

- No real subscribers, owners, testimonials, quotes or case studies.
- No usage, adoption, uptime or performance figures; the fixture's numbers are fictional and must never be presented as real. The legacy app had no telemetry, and realistic-load validation is still open (D16).
- No pricing, plans or purchase flow; the product is not commercial.
- No real channel lineup, bundle catalogue or group names; the demo bundles and counts are invented, and the Danish core lineup belongs to the original deployment only.
- No screenshots of the rewrite's implemented UI; only the placeholder page exists.
- No verified player compatibility tests for the rewrite, and no Dispatcharr contract tests yet.
- No accessibility audit of the rewrite.

## Product Principles

1. **Plex friendship is the only entitlement.** An accepted friendship grants access, a pending one grants nothing, and when the friendship ends access ends. Nobody gets in by signing up, paying or being added by hand.
2. **Fail closed on exposure.** Zero groups means zero channels. When information is missing, a check fails or scoping can't be confirmed, otpravkarr narrows or withholds access rather than widening it.
3. **Stay a bridge.** Dispatcharr and its plugins own channels, groups, guide data and video; otpravkarr owns only who has an account, which groups it can see and which kinds of content are on for it. It doesn't serve video, edit the catalogue or change plugin settings.
4. **Access never widens silently.** What a subscriber or the owner chose is kept apart from what is currently in effect. Catalogue churn can take channels out of effect, but choices survive and nothing is granted that nobody chose.
5. **The owner decides; subscribers never need Dispatcharr.** Every control a subscriber has lives in otpravkarr and covers only what the owner allows. Nothing sends a subscriber into Dispatcharr to manage their own access.
6. **Say the consequence first.** Every action that changes or ends access says what will happen before it happens, secrets stay hidden until the person asks, and a slow or failing upstream shows an honest degraded state instead of a hang or a blank page.

## Accessibility and inclusion

Keyboard access throughout, visible focus, labelled inputs, text plus icon for status, 44px touch targets, readable text at 200% zoom, and reduced-motion alternatives. Target WCAG AA text contrast. Never use color alone to communicate a decision. Bundle fonts locally in the implementation.

## Product source and rewrite proposals

Read [the legacy product specification](docs/product/legacy-spec.md) for domain behavior and current gaps. Routes in this handoff describe proposed information architecture, not implemented endpoints.

The new direction changes the interface; preserve the original specification's authorization and lifecycle behavior, except where `docs/decisions.md` changes it (D19–D26 change the Dispatcharr access model).

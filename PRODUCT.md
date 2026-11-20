# otpravkarr product context

<!-- impeccable:product-schema 1 -->

## Product Purpose

otpravkarr lets a Plex server owner share their Dispatcharr TV lineup with the people they share Plex with. Each viewer gets personal playback details for their own IPTV player.

- **The admin** chooses during onboarding whether all accepted Plex friends may join or only the friends they select. They choose a starter lineup separately. Their dashboard shows who may join, who has joined, which lineups each person receives and which extra lineups they may choose. The admin can change the preset later and preview who would gain or lose access.
- **The viewer** signs in with Plex. Only an eligible person's first successful sign-in creates their Dispatcharr viewing account. Someone who has yet to join needs no account there, however many friends the owner has. The viewer gets a playlist link, an M3U download, guide and Xtream Codes details, and short instructions for their player.
- **The lineup** is built in Dispatcharr. The admin shares its channel profiles through otpravkarr, individually or in combination. Editing a profile in Dispatcharr updates the lineup for everyone who receives it. Optional plugins run there too.

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
- **Admin:** Lineup policy settings. Proposed route: `/admin/settings/lineup`.

## Positioning

- otpravkarr is a small bridge between one Plex server owner's existing circle of friends and that owner's Dispatcharr. It is not a multi-tenant or commercial IPTV panel: there is no sign-up, pricing or purchase, and no access for anyone outside the owner's accepted Plex friends.
- The alternative it replaces is the owner creating Dispatcharr accounts by hand, handing out passwords and remembering to delete them.
- An accepted Plex friendship and the owner’s chosen preset determine eligibility. Selecting a friend or refreshing the roster records eligibility only. Losing the friendship or revoking access disables playback when otpravkarr processes the change.
- Dispatcharr enforces the combined set of enabled live channels in a viewer’s assigned profiles at playback. The assignment must be verified before otpravkarr issues credentials.
- Subscribers use otpravkarr to manage the lineups the owner offers them. The owner controls movie, series, catch-up and adult content settings (D21, D22).
- Dispatcharr and its optional plugins manage imports, channels, groups, profile contents, guide data and streams. otpravkarr manages viewer accounts and assigns existing profiles. A group the admin wants to share independently can have its own Dispatcharr profile.

## Operating Context

- **Scale and shape.** One owner may have hundreds of Plex friends. A provider catalogue may have hundreds of thousands of entries. Viewers choose from the lineups the owner offers. First sign-in and player import at this scale still need measurement (D16). It runs as one process in one container on one port, with container packaging in the separate `otpravkarr-docker` repository; horizontal scaling is an accepted limit, not a goal.
- **Upstream systems.** Plex (plex.tv account services and the owner's Plex Media Server) for sign-in, identity and the friends list; nothing is written to Plex. Dispatcharr for users, channel profiles, channel groups, the guide and streams, plus the Dispatcharr plugins installed there, which may rename, regroup, quarantine or hide channels on their own schedules.
- **Downstream.** The subscriber's own IPTV player apps, fed with Dispatcharr's playlist, player-API and guide URLs. The setup guide recommends free and open-source players only, computers first: [Fred TV](https://github.com/Fredolx/open-tv) (Windows, macOS and Linux), [IINA](https://iina.io/) (macOS) and [VLC](https://www.videolan.org/vlc/) (every platform, phones and TVs included). Other Xtream-Codes-capable players should work with the same URLs, but none is verified yet.
- **Network placement.** Typically on the same private network as Dispatcharr and behind the operator's reverse proxy. The operator controls the host, the proxy and Dispatcharr; Dispatcharr's public ingress is the operator's concern, outside the app.
- **Subscriber ritual.** Sign in with Plex once; copy the playlist, player-API and guide URLs (or show a QR code on request) into a player; come back occasionally to change their selected lineups where the owner allows, refresh credentials, or re-download a playlist snapshot.
- **Owner ritual.** A one-time first-run setup that connects Plex and Dispatcharr; then occasional visits to the admin console to check Plex, Dispatcharr and database health, run a sync by hand, manage subscribers, review the audit log, and set eligibility and share lineups. A background sync on an interval (15 minutes by default in the legacy app) keeps Plex friendships, local records and Dispatcharr accounts converged in between.
- **Language.** The legacy app was British English only with en-GB dates, and one portal string assumed a Danish core lineup from the original deployment. The rewrite is translatable (D28): British English, the default, and Danish, with dates and numbers formatted for each viewer's language. Lineup wording comes from the owner's own configuration, never from a hard-coded lineup.
- **Rewrite state.** The foundation includes startup and health checks, secret storage support, English and Danish text, and the first-run owner claim. The subscriber portal and sharing dashboard are planned.

## Product requirements

- Name always lowercase otpravkarr. Only accepted friends who meet the owner’s eligibility preset can join.
- Credentials masked until revealed. QR code generated only when Show QR code is pressed.
- Streams and guide come from Dispatcharr. No embedded video player or programme guide.
- A viewer can receive a fixed lineup and optional extras. Dispatcharr allows every otherwise eligible channel when a viewer has no assigned profiles. If otpravkarr detects this, it withholds new playback credentials and disables existing ones until it verifies the intended lineup.
- Downloaded M3U is a snapshot and does not update automatically. Owner and subscriber sessions are separate.

## Visual goals

Offer light and dark colour schemes. Keep motion subtle on the dashboard and viewer pages. The earlier Dark Matter design seed has been withdrawn. The visual design phase follows the product goals.

## Evidence on Hand

**On hand:**

- `legacy-old/v1` branch: the previous code (v1, in production use for the original deployment), for reference only; nothing is brought over from it. The behaviour the rewrite keeps from it is in `docs/SPEC.md` (the capability map and its Module notes) and `docs/decisions.md`.
- `docs/research/dispatcharr.md`: research against Dispatcharr v0.32.0 (sources read 2026-10-18), including where current Dispatcharr behaviour differs from what the legacy app assumed. The owner has reviewed it, and its candidate decisions are now D19–D26.
- `docs/research/plex.md`: how Plex behaved as the legacy app found it, not re-verified; the Plex library audit (D18) checks it.
- `docs/decisions.md`: the decided and open `D<n>` entries for the stack and the Dispatcharr access model.
- `docs/SPEC.md`: the built ground-floor spec, the capability map and its Module notes, with the product changes awaiting a revised map marked there.
- `.impeccable/surfaces/*.md`: eight route briefs (`/`, `/portal`, `/portal/channels`, `/portal/setup`, `/admin`, `/admin/users`, `/admin/settings/connections`, `/admin/settings/lineup`), from the withdrawn design seed. The briefs need revision against the approved product goals before use.
- `DESIGN.md` and `panda.config.ts`: the withdrawn Dark Matter seed and the tokens used by the existing foundation.
- `tests/fixtures/demo-fixtures.json`: a fictional fixture (snapshot date 2025-10-15: 42 users, 38 active, 4 inactive, four demo bundles with channel counts). The people in the briefs (Alex, Jordan, Morgan) and the `*.example` addresses are placeholders.
- `static/otpravkarr-icon.svg`: the product icon. Licensing: [README.md](README.md#license).

**Not on hand (never fabricate):**

- No real subscribers, owners, testimonials, quotes or case studies.
- No usage, adoption, uptime or performance figures; the fixture's numbers are fictional and must never be presented as real. The legacy app had no telemetry, and realistic-load validation is still open (D16).
- No pricing, plans or purchase flow; the product is not commercial.
- No real channel lineup, bundle catalogue or group names; the demo bundles and counts are invented, and the Danish core lineup belongs to the original deployment only.
- No screenshots of the rewrite's implemented UI; only the placeholder page exists.
- No verified player compatibility tests for the rewrite, and no Dispatcharr contract tests yet.
- No accessibility audit of the rewrite.

## Product Principles

1. **The owner decides who may join.** Plex confirms friendship. The owner chooses whether that is sufficient or a personal grant is also required.
2. **Fail closed on exposure.** Withhold or disable playback credentials when a viewer has no verified shared lineup. When information is missing, a check fails or scoping can't be confirmed, otpravkarr narrows or withholds access rather than widening it.
3. **Keep catalogue editing in Dispatcharr.** otpravkarr shows which profiles each person can watch and manages their access to those profiles.
4. **Share profiles deliberately.** A new profile needs the owner’s approval before it can be offered. Changes inside an already shared profile follow Dispatcharr. Flag discrepancies between the profiles a viewer should receive and those actually assigned.
5. **The owner decides; subscribers never need Dispatcharr.** Every control a subscriber has lives in otpravkarr and covers only what the owner allows. Nothing sends a subscriber into Dispatcharr to manage their own access.
6. **Say the consequence first.** Every action that changes or ends access says what will happen before it happens, secrets stay hidden until the person asks, and a slow or failing upstream shows an honest degraded state instead of a hang or a blank page.

## Accessibility and inclusion

Keyboard access throughout, visible focus, labelled inputs, text plus icon for status, 44px touch targets, readable text at 200% zoom, and reduced-motion alternatives. Target WCAG AA text contrast. Never use color alone to communicate a decision. Bundle fonts locally in the implementation. A skip link comes first in every shell; navigation and filter regions are labelled; every icon-only control has a label; dialogs trap focus; live regions announce copy results and saved changes; invalid inputs are flagged and linked to their help text; first-run steps are announced as done or current; and menu and drawer buttons state whether they are open and what they control.

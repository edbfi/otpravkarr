---
version: 1
slug: "route-portal-setup"
primary_target: "route:/portal/setup"
related_targets: []
---

# otpravkarr Desktop and TV setup guide

## Status

Proposed design seed for review. Mode: **read**. Audience: **Subscriber**. Proposed route: `/portal/setup`.

## Purpose and composition

Top device tabs TV / Computer / Mobile. Main numbered guide and supporting masked URL card. Editorial headline, practical reading width.

## Visual reference

[Detailed mockup](../../docs/design/screens/04-player-setup.webp)

Use the shared [design system](../../DESIGN.md). Match hierarchy, density and palette while building real semantic components. This is a screen composition; any side-by-side stages are separate routes or states.

## Required content

'Set up your player.' Computer selected, VLC selected. Steps Open VLC, Choose Media then Open Network Stream, Paste your playlist URL, Open the stream. Masked Playlist URL with Copy, Reveal. 'Show QR code' button, QR absent. 'Choose a different player'.

## Acceptance criteria

Use VLC for computer; TiviMate belongs to TV tab only. No in-app player. Keep user task language plain and precise.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json); do not infer calculations from raster text.
- Apply the raster corrections below.
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.

## Raster corrections

Use the images for composition and visual character. Use DESIGN.md, PRODUCT.md, this brief's acceptance criteria and the demo fixtures for exact values and behavior. Body copy, chart axes, tiny icons and font glyphs remain illustrative raster renderings. Rebuild them as native accessible UI and verify them against the specification. A PNG cannot verify focus order, screen-reader announcements, permission checks or real responsiveness.

- Subscriber credentials may be revealed on demand; stored Plex tokens and Dispatcharr API keys are replacement-only. These are different field components.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the attached detailed image as a composition reference and the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then compare desktop/mobile screenshots and audit the required states. Do not add incidental actions visible only in the raster.

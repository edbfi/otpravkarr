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

None yet. Use the shared [design system](../../DESIGN.md).

## Required content

'Set up your player.' Computer selected, VLC selected. Steps Open VLC, Choose Media then Open Network Stream, Paste your playlist URL, Open the stream. Masked Playlist URL with Copy, Reveal. 'Show QR code' button, QR absent. 'Choose a different player'.

## Acceptance criteria

Use VLC for computer. Recommend only the free and open-source players PRODUCT.md names. No in-app player. Keep user task language plain and precise.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json).
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.
- Subscriber credentials may be revealed on demand; stored Plex tokens and Dispatcharr API keys are replacement-only. These are different field components.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then check desktop and mobile widths and audit the required states.

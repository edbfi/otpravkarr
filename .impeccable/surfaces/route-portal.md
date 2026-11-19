---
version: 1
slug: "route-portal"
primary_target: "route:/portal"
related_targets: []
---

# otpravkarr Subscriber access dashboard

## Status

Proposed design seed for review. Mode: **operate**. Audience: **Subscriber**. Proposed route: `/portal`.

## Purpose and composition

Comfortable 672px central credentials column, warm serif greeting, sticky minimal top header. Small help panel supports task without overpowering form.

## Visual reference

None yet. Use the shared [design system](../../DESIGN.md).

## Required content

'Welcome back, Alex.' Active badge. Credentials and Setup guide tabs. Masked Playlist URL, Player API URL, Guide URL, each with Copy and Reveal. 'Show QR code'. 'Download M3U snapshot', helper 'Snapshots do not update automatically.' 'My channels' link. Credentials ready text.

## Acceptance criteria

Only subscriber navigation. Mask all three credential values. No QR tile visible before action; no automatic QR. No admin toggle.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json).
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.
- Subscriber credentials may be revealed on demand; stored Plex tokens and Dispatcharr API keys are replacement-only. These are different field components.

## Mobile (390px)

Sticky simple header and large touch targets. No admin drawer. Labels and masked fields stack without horizontal overflow.

Required content: Welcome back Alex, Active, masked Playlist URL, Player API URL, Guide URL, Copy, Reveal, Show QR code. Feedback: small toast 'Playlist URL copied'. No QR shown automatically.

## Access states

Each is its own state of this route, not one screen.

- Revoked: 'Your access has ended.' Sign out.
- Provisioning problem: 'We could not prepare your player account.' Retry.
- Copy success: 'Copied'.
- Refresh dialog: 'Refresh credentials?' 'Existing player URLs will stop working.' Cancel / Refresh credentials.
- Field anatomy: focused masked field with its label.

No secret rendered in feedback. The destructive action is true red, not orange. Text and icon convey each state.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then check desktop and mobile widths and audit the required states.

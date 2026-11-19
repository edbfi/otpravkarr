---
version: 1
slug: "route"
primary_target: "route:/"
related_targets: []
---

# otpravkarr Subscriber landing and sign-in

## Status

Proposed design seed for review. Mode: **persuade**. Audience: **Visitor**. Proposed route: `/`.

## Purpose and composition

Quiet split landing with large serif copy, orange sign-in button and a restrained orange-lit cinema crop on right. No authenticated navigation.

## Visual reference

None yet. Use the shared [design system](../../DESIGN.md).

## Required content

Wordmark otpravkarr and the language switcher (`LanguageSwitcher.svelte`, docs/SPEC-i18n.md). Heading 'Stream access.' Body 'Sign in with Plex to get your channel access and set up your player.' Primary 'Continue with Plex'. Helper 'Access is available to accepted friends of the server owner.' Three plain setup steps Sign in, Copy your details, Open your player. Small Help link.

## Acceptance criteria

No sign-up/pricing/purchase. No admin links, fake Plex login fields, playback preview or promises of public access. No confirmation flow on the landing page.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json).
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then check desktop and mobile widths and audit the required states.

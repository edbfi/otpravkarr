---
version: 1
slug: "route-admin"
primary_target: "route:/admin"
related_targets: []
---

# otpravkarr Owner admin overview

## Status

Proposed design seed for review. Mode: **operate**. Audience: **Admin**. Proposed route: `/admin`.

## Purpose and composition

Dense admin sidebar, sober Fraunces heading, three compact health indicators, user summary, sync section and audit feed. Less art than subscriber landing.

## Visual reference

None yet. Use the shared [design system](../../DESIGN.md).

## Required content

'Overview.' Plex Healthy, Dispatcharr Healthy, Database Healthy. 42 users, 38 active, 4 inactive. Sync last run 5 min ago. 'Run sync now'. Recent activity 'Alex’s channel choices updated', 'Jordan’s access disabled'. Available friends 3, helper 'Accounts are created when friends sign in.'

## Acceptance criteria

Do not invent active stream counts, bulk-import friends action or live polling. Dashboard refreshes after explicit sync.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json).
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.
- Keep global admin sidebar navigation stable; settings subsection links belong inside Settings.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then check desktop and mobile widths and audit the required states.

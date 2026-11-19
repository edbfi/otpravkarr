---
version: 1
slug: "route-admin-settings-connections"
primary_target: "route:/admin/settings/connections"
related_targets: []
---

# otpravkarr Connections and sync settings

## Status

Proposed design seed for review. Mode: **operate**. Audience: **Admin**. Proposed route: `/admin/settings/connections`.

## Purpose and composition

Structured settings page with vertical subsection links Connections, Lineup, Security, Audit. Independent Plex and Dispatcharr forms with tested/saved receipts.

## Visual reference

None yet. Use the shared [design system](../../DESIGN.md).

## Required content

'System configuration.' Plex address https://plex.example, stored token •••• 4821, blank New token, Test connection, Save Plex connection. Dispatcharr internal address https://dispatcharr.example, public address https://tv.example, API key stored •••• 9182, Test connection, Save Dispatcharr connection. Sync every 15 minutes. 'Save sync interval'.

## Acceptance criteria

Stored secrets remain hidden. Each form has own save and result. User-facing help distinguishes internal connection from player-facing public address.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json).
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.
- Subscriber credentials may be revealed on demand; stored Plex tokens and Dispatcharr API keys are replacement-only. These are different field components.
- Keep global admin sidebar navigation stable; settings subsection links belong inside Settings.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then check desktop and mobile widths and audit the required states.

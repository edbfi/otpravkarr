---
version: 1
slug: "route-admin-settings-lineup"
primary_target: "route:/admin/settings/lineup"
related_targets: []
---

# otpravkarr Lineup policy settings

## Status

Proposed design seed for review. Mode: **operate**. Audience: **Admin**. Proposed route: `/admin/settings/lineup`.

## Purpose and composition

Admin settings with core-plus-bundles radio group, clear core/approved groups selection, editable bundle rows.

## Visual reference

None yet. Use the shared [design system](../../DESIGN.md).

## Required content

'Lineup policy'. Core plus bundles selected. Fixed lineup and Approved selection alternatives. Core groups News / Regional; available bundles Sports, Cinema, International. Edit bundle panel has Name, Enabled, Groups and immutable ID. 'Save lineup policy'.

## Acceptance criteria

No empty profile selector. Bundle IDs immutable. No settings to manage Dispatcharr channels.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json).
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.
- Use the fixture's disjoint demo bundles: Core 86, Sports 42, Cinema 28, International 31. Selected Core + Sports + Cinema contains 156 channels.
- No 'Allowed website addresses' panel, address field, lockout warning or Save addresses: the app stores no address list, because `sign-in`'s cross-origin check asks the browser instead.
- Keep global admin sidebar navigation stable; settings subsection links belong inside Settings.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then check desktop and mobile widths and audit the required states.

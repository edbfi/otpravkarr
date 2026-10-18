---
version: 1
slug: "route-admin-settings-lineup"
primary_target: "route:/admin/settings/lineup"
related_targets: []
---

# otpravkarr Lineup policy and security settings

## Status

Proposed design seed for review. Mode: **operate**. Audience: **Admin**. Proposed route: `/admin/settings/lineup`.

## Purpose and composition

Admin settings with core-plus-bundles radio group, clear core/approved groups selection, editable bundle rows, narrow security summary.

## Visual reference

[Detailed mockup](../../docs/design/screens/08-settings-lineup.webp)

Use the shared [design system](../../DESIGN.md). Match hierarchy, density and palette while building real semantic components. This is a screen composition; any side-by-side stages are separate routes or states.

## Required content

'Lineup policy'. Core plus bundles selected. Fixed lineup and Approved selection alternatives. Core groups News / Regional; available bundles Sports, Cinema, International. Edit bundle panel has Name, Enabled, Groups and immutable ID. Secondary security panel 'Allowed website addresses', https://access.example, Save addresses. 'Save lineup policy'.

## Acceptance criteria

No empty profile selector. Bundle IDs immutable. Warn if an address change would prevent current browser access. No settings to manage Dispatcharr channels.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json); do not infer calculations from raster text.
- Apply the raster corrections below.
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.

## Raster corrections

Use the images for composition and visual character. Use DESIGN.md, PRODUCT.md, this brief's acceptance criteria and the demo fixtures for exact values and behavior. Body copy, chart axes, tiny icons and font glyphs remain illustrative raster renderings. Rebuild them as native accessible UI and verify them against the specification. A PNG cannot verify focus order, screen-reader announcements, permission checks or real responsiveness.

- Use the fixture's disjoint demo bundles: Core 86, Sports 42, Cinema 28, International 31. Selected Core + Sports + Cinema contains 156 channels. Mobile raster counts are illustrative.
- Keep global admin sidebar navigation stable; settings subsection links belong inside Settings, even where a raster simplifies the sidebar.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the attached detailed image as a composition reference and the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then compare desktop/mobile screenshots and audit the required states. Do not add incidental actions visible only in the raster.

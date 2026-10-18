---
version: 1
slug: "route-portal-channels"
primary_target: "route:/portal/channels"
related_targets: []
---

# otpravkarr Channel choices

## Status

Proposed design seed for review. Mode: **operate**. Audience: **Subscriber**. Proposed route: `/portal/channels`.

## Purpose and composition

Single main selection column with bundle checkbox rows, narrow saved-selection summary and sticky bottom save action. Same header as user dashboard.

## Visual reference

[Detailed mockup](../../docs/design/screens/03-channel-bundles.webp)

Use the shared [design system](../../DESIGN.md). Match hierarchy, density and palette while building real semantic components. This is a screen composition; any side-by-side stages are separate routes or states.

## Required content

'My channel bundles.' 'Your core lineup is always included.' Core 86 channels locked Included. Sports 42 checked, Cinema 28 checked, International 31 unchecked. '2 bundles selected'. Search bundles field. Primary 'Save channel choices'. Helper 'Changes update the channels available in your player.'

## Acceptance criteria

Bundle choices change access only. Core cannot be deselected. No administrative bundle editor, profile creation or exposed backend terminology.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json); do not infer calculations from raster text.
- Apply the raster corrections below.
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.

## Mobile (390px)

[Mobile board](../../docs/design/screens/09-mobile-subscriber.webp), middle view.

Three mobile web screens at 390px share one board: access credentials, channel bundles and copy feedback. No phone hardware. Sticky simple header and large touch targets. No admin drawer. Labels and masked fields stack without horizontal overflow.

Required content: Core included, Sports checked, Cinema checked, Save channel choices.

## Empty selection state

[States and components board](../../docs/design/screens/10-recovery-and-components.webp), zero-selection specimen: 'No channels selected. Your player will show no channels.' Save choices. Text and icon convey the state.

## Raster corrections

Use the images for composition and visual character. Use DESIGN.md, PRODUCT.md, this brief's acceptance criteria and the demo fixtures for exact values and behavior. Body copy, chart axes, tiny icons and font glyphs remain illustrative raster renderings. Rebuild them as native accessible UI and verify them against the specification. A PNG cannot verify focus order, screen-reader announcements, permission checks or real responsiveness.

- Use the fixture's disjoint demo bundles: Core 86, Sports 42, Cinema 28, International 31. Selected Core + Sports + Cinema contains 156 channels. Mobile raster counts are illustrative.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the attached detailed image as a composition reference and the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then compare desktop/mobile screenshots and audit the required states. Do not add incidental actions visible only in the raster.

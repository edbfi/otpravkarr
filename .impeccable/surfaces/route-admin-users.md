---
version: 1
slug: "route-admin-users"
primary_target: "route:/admin/users"
related_targets: []
---

# otpravkarr Subscriber administration

## Status

Proposed design seed for review. Mode: **operate**. Audience: **Admin**. Proposed route: `/admin/users`.

## Purpose and composition

Filterable dense table and selected-user detail drawer. Status filter chips and action menu clear. Orange action, teal statuses, red destructive dialog specimen.

## Visual reference

[Detailed mockup](../../docs/design/screens/06-admin-users.webp)

Use the shared [design system](../../DESIGN.md). Match hierarchy, density and palette while building real semantic components. This is a screen composition; any side-by-side stages are separate routes or states.

## Required content

'Users'. Search Plex or Dispatcharr name. Columns Plex user, Player account, Mode, Policy, Status, Last access. Alex Automatic / Core plus bundles / Active; Jordan Automatic / Fixed / Inactive; Morgan Self-managed / Approved picks / Drift detected. Selected Alex detail shows 'Disable access' action with consequence 'Stream URLs will stop working immediately.' Cancel / Disable access dialog.

## Acceptance criteria

No credentials copied into table as default. Drift attention distinct from active status. Disable action confirmation explains account effects.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json); do not infer calculations from raster text.
- Apply the raster corrections below.
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.

## Raster corrections

Use the images for composition and visual character. Use DESIGN.md, PRODUCT.md, this brief's acceptance criteria and the demo fixtures for exact values and behavior. Body copy, chart axes, tiny icons and font glyphs remain illustrative raster renderings. Rebuild them as native accessible UI and verify them against the specification. A PNG cannot verify focus order, screen-reader announcements, permission checks or real responsiveness.

- The user-list raster contains an incidental Add user button. Omit it; an accepted friend receives an account when they sign in. Existing owner self-subscription remains a separate product workflow.
- Keep global admin sidebar navigation stable; settings subsection links belong inside Settings, even where a raster simplifies the sidebar.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the attached detailed image as a composition reference and the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then compare desktop/mobile screenshots and audit the required states. Do not add incidental actions visible only in the raster.

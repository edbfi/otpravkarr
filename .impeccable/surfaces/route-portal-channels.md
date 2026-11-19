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

None yet. Use the shared [design system](../../DESIGN.md).

## Required content

'My channel bundles.' 'Your core lineup is always included.' Core 86 channels locked Included. Sports 42 checked, Cinema 28 checked, International 31 unchecked. '2 bundles selected'. Search bundles field. Primary 'Save channel choices'. Helper 'Changes update the channels available in your player.'

## Acceptance criteria

Bundle choices change access only. Core cannot be deselected. No administrative bundle editor, profile creation or exposed backend terminology.

- Preserve audience boundaries from [product context](../../PRODUCT.md).
- Use canonical data in [demo fixtures](../../tests/fixtures/demo-fixtures.json).
- Make loading, empty, failure, pending and saved states available where the workflow needs them.
- Test keyboard focus, visible labels, disabled behavior and 200% zoom; target 360, 390, 768 and 1440px viewports.
- Read reduced-motion preference before animating. Long names and translated text must wrap without hiding the primary action.
- Use the fixture's disjoint demo bundles: Core 86, Sports 42, Cinema 28, International 31. Selected Core + Sports + Cinema contains 156 channels.

## Mobile (390px)

Sticky simple header and large touch targets. No admin drawer. Labels and masked fields stack without horizontal overflow.

Required content: Core included, Sports checked, Cinema checked, Save channel choices.

## Empty selection state

'No channels selected. Your player will show no channels.' Save choices. Text and icon convey the state.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md and this brief first. Use the named tokens as exact values. Preserve Dark Matter. Keep the server's domain decisions authoritative. Reuse existing Panda CSS tokens and Ark UI primitives. Build native accessible controls, then check desktop and mobile widths and audit the required states.

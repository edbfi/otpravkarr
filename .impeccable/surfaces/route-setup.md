---
version: 1
slug: "route-setup"
primary_target: "route:/setup"
related_targets: []
---

# otpravkarr First-run claim

## Status

Approved by the owner with `setup`'s spec (2026-11-16) and built in #244, code-led, with no mockup. Mode: **operate**. Audience: **the person installing otpravkarr**, who can read the server console. Route: `/setup`. Module: `setup` ([docs/SPEC-setup.md](../../docs/SPEC-setup.md)). Ported from obzorarr's claim brief for behaviour; the look is otpravkarr's own (Dark Matter).

## Purpose and composition

One quiet, centred form within the 672px form width: the first screen a fresh install shows, before anyone is signed in. No sidebar, admin links or subscriber navigation; the header has only the otpravkarr icon (`static/otpravkarr-icon.svg`) beside the lowercase wordmark otpravkarr, and the language switcher (`LanguageSwitcher.svelte`). Operational, not expressive: no grain, no photographic crop.

## Visual reference

None yet. Use the shared [design system](../../DESIGN.md): `background` page, one flat `surface` panel with a 1px `border` and `panel` radius, an `h1` heading in Fraunces, labelled `text-field` controls on `control-border`, helper text in `muted`, one solid `primary` button, `danger` text for errors and the `secondary` focus ring.

## Required content

Heading 'Claim this otpravkarr'. One line: 'Enter the setup token printed in the server console, then create the owner account.' Fields: 'Setup token' (helper: 'Shown as xxxx-xxxx-xxxx. A new one is printed every 15 minutes.'), 'Username', 'Password' (helper: 'At least 15 characters.', with a Show/Hide button at the end of the field: a 20px line eye icon beside its text label). Primary action 'Claim and create owner'. While submitting: 'Claiming…', and the button can't be pressed twice. Every string comes from the messages, in English and Danish; the numbers in the helpers come from the constants the logic uses.

## Acceptance criteria

- Errors sit beside their field with helper/error IDs and `aria-invalid`; a wrong or expired token gets one message that names the console, never which of the two it was.
- After a failed submit, the username is kept; the token and password are not, and focus moves to the first field with an error.
- The token field takes the token with or without dashes and in any case, and inserts the dashes as it is typed (it still takes any form without JavaScript). It is not a password field, so the person can check what they typed, and it is set in IBM Plex Mono, like the console line it came from. A token in the page's URL is ignored.
- The Show/Hide button reveals only what was just typed, says whether the password is shown, and appears only once the page has JavaScript.
- No other viewer, server, Plex or Dispatcharr detail appears.
- Test keyboard focus, visible labels, disabled behaviour, reduced motion and 200% zoom; target 360, 390, 768 and 1440px viewports, in English and Danish. Translated text wraps without hiding the primary action; at 360px the button is above the fold.
- States: initial, field errors, token refused, submitting. After success the browser leaves the page.

## Handoff prompt

> Implement only this surface in otpravkarr's existing application. Read PRODUCT.md, DESIGN.md, docs/SPEC-setup.md and this brief first. Reuse existing Panda CSS tokens; build native accessible form controls. Keep it quiet: this is an operational screen.

## Direction contract

THESIS: a console-to-browser handoff for the person who just started otpravkarr: one quiet, familiar form whose only unusual input, the token, reads like the console line it came from; it refuses the multi-card onboarding wizard.

OWN-WORLD: Dark Matter at its quietest: `background` page, one flat `surface` panel with a 1px `border` and `panel` radius, Fraunces `h1`, Instrument Sans labels and helpers in `muted`, `text-field` controls on `control-border`, the token in IBM Plex Mono, one solid `primary` button with `background`-coloured text, `danger` text for errors, the `secondary` focus ring. No grain, no imagery.

STORY: the installer reads one line, copies the token from the console, picks a username and a password, and claims the instance in one submission; a refused token says where to find the right one.

FIRST VIEWPORT: a header across the 672px form width with the otpravkarr icon and lowercase wordmark at the start and the language switcher at the end; below it the panel: `h1`, the one line, then the token, username and password fields with their helpers, then the full-width primary button. At 360px the button is above the fold.

FORM: seed: none (pinned) "One quiet, centred form within the 672px form width: the first screen a fresh install shows, before anyone is signed in."

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

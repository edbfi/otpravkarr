---
version: 1
slug: "route-setup"
primary_target: "route:/setup"
related_targets: []
---

# otpravkarr First-run claim

## Status

Proposed brief for review, with no mockup yet. Mode: **operate**. Audience: **the person installing otpravkarr**, who can read the server console. Route: `/setup`. Module: `setup` ([docs/SPEC-setup.md](../../docs/SPEC-setup.md)). Ported from obzorarr's claim brief for behaviour; the look is otpravkarr's own (Dark Matter).

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

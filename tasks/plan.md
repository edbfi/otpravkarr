# Implementation plan: `i18n`

## Overview

Build module 2 of the capability map as [docs/SPEC-i18n.md](../docs/SPEC-i18n.md) specifies, ported
from obzorarr (its #297 to #301): the messages Paraglide JS compiles, the message check, choosing
each request's language, the language switcher and the formatters, with D29's validations. Three
tasks, one PR each, each test first. The tasks are in [todo.md](todo.md).

## Architecture decisions

- **The riskiest work comes early.** Task 1 wires Paraglide into the build, settles the Weblate
  round trip and adds the message check before any page uses a message, so a surprise in the
  toolchain or the file format changes nothing written in it. Task 2 then runs the middleware
  through the built adapter-bun server, where Paraglide issue
  [#725](https://github.com/opral/paraglide-js/issues/725) would show, and settles the concurrency
  check.
- **Every PR leaves `main` working.** Task 1 compiles the placeholder's messages, but the page keeps
  its own text until task 2 adds the server's language handle and the browser hook. A page that
  rendered messages without them would let the browser runtime choose a language by itself and
  write the cookie the viewer never asked for (SPEC-i18n.md, "In the browser").
- **The server and the browser change together,** with the switcher. Task 2 adds both hooks,
  because each half alone is wrong: the server's choice means nothing if the browser chooses again
  on hydration. The switcher joins them, so `i18n.test.ts` lands whole.
- **The message check comes with the messages** (task 1): it guards every message from the first
  one, and its tests are #301's, written first.
- **Each validation's evidence goes in the body of the PR that settles it:** the pinned versions
  with no Node on `PATH` and the Weblate round trip in task 1's, the concurrency check in task 2's,
  and the full list in task 3's, which closes D29. The Weblate round trip and the concurrency check
  cite obzorarr's #297 and #298 only when the body shows that the versions and files the spec lists
  match obzorarr's `7368cff`; otherwise they run again here (SPEC-i18n.md, "Validation"). The
  temporary messages, route and scripts are never committed.
- **Facts change in the task that changes them.** Each task updates SPEC.md's tech stack, Commands,
  Design tokens and testing sections, and AGENTS.md's structure, as its files land. Task 3 does the
  rest of the spec's "Docs this module changes when built" list and the end-of-work-stream cleanup.

## Task list

### Phase 1: the toolchain

- [ ] Task 1: Paraglide compiles the messages, and the message check guards them

### Phase 2: each page in the viewer's language

- [ ] Task 2: each request gets the viewer's language, the browser keeps it, the switcher changes
  it

### Checkpoint: after task 2

- [ ] `check`, `test`, `lint`, `build`, `smoke` and prek pass; CI's `checks`, `smoke` and `ci-ok`
  pass.
- [ ] The built server serves `/` in Danish to a Danish browser and in English otherwise, the
  switcher changes it, and `/healthz` is unchanged.

### Phase 3: the tools later modules write through

- [ ] Task 3: formatting numbers and dates, and closing the work stream

### Checkpoint: complete

- [ ] Every success criterion in SPEC-i18n.md is met.
- [ ] The end-of-work-stream cleanup (AGENTS.md, "Cleanup procedures") is done in task 3.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The middleware returns nothing in the adapter-bun build (#725) | High | Task 2's e2e tests run against the built server |
| The CLI and the Vite plugin write different layouts into one folder | Medium | `outputStructure: "message-modules"` in the shared config; task 1 runs `check` beside `dev` |
| Weblate writes the files in a shape Biome or the plugin refuses | Medium | Task 1's round trip, before any real message is used |
| Concurrent requests mix languages under Bun's AsyncLocalStorage | High | Task 2's 200-request check against the built server |
| Generated output trips Biome, Panda or the docs-set hook | Low | The two `.gitignore` lines and Panda's `exclude` land in task 1; prek runs with the output present |
| A version or file has moved since obzorarr validated it | Medium | Each body compares them with `7368cff`, and reruns the evidence when anything differs |
| The agents' Danish reads badly | Low | The owner may spot-check it; Weblate corrects it later (SPEC-i18n.md, "Who writes them") |

## Sibling apps

comradarr, zondarr and zimuarr port `i18n` from obzorarr in their own threads. A bug found in
obzorarr's `i18n` here is fixed in otpravkarr, named as a difference, and reported in the PR body
and to the owner, so obzorarr and the others get the same fix.

## Open questions

None for the build. The owner approves this plan and the spec before task 1 starts.

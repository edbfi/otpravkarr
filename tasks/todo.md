# Tasks: `i18n`

The spec is [docs/SPEC-i18n.md](../docs/SPEC-i18n.md), and the plan is [plan.md](plan.md). Each
task is one PR and writes its tests first. Each one adds its files to AGENTS.md's structure, ticks
off its items in `tasks/`, names the sibling apps in its PR body (AGENTS.md, Shared groundwork),
and runs `bun run --bun check`, `bun run --bun test`, `bun run --bun lint` and
`prek run --all-files --hook-stage manual` before every commit. Paths under `src/lib/` are
shortened to `lib/`.

## Task 1: Paraglide compiles the messages, and the message check guards them

**Description:** obzorarr's #297, plus #301's message check. Add the two packages and the inlang
project, and compile the messages in `prepare`, `check`, dev, build and Vitest. The message files
hold the placeholder page's text in English and Danish, which the page starts using in task 2. Run
or cite the Weblate round trip. Add `lib/shared/i18n/messages.test.ts`.

**Acceptance criteria:**
- [ ] `@inlang/paraglide-js` and `@inlang/plugin-i18next` are exact-pinned dev dependencies at their
  newest stable release (D32). `project.inlang/settings.json` and
  `project.inlang/paraglide.config.ts` are as the spec gives them, and the Vite plugin is added
  with nothing else.
- [ ] `prepare` and `check` compile the messages after `svelte-kit sync` and before Panda's
  codegen, calling the CLI as `bun --bun <bin>`, so a fresh clone's `bun ci` compiles them, and
  `check` then type-checks `project.inlang/*.ts`. Everything passes with no Node on `PATH` (CI's
  shims). Running `check` while `dev` is up doesn't rewrite the output under the dev server.
- [ ] A call to a message that doesn't exist fails `check`, shown with a probe that isn't
  committed, its output in the PR body.
- [ ] `src/lib/paraglide/` and `project.inlang/cache/` are gitignored, Panda's `exclude` skips the
  output, and `lint` and prek pass with it present.
- [ ] The message files are flat and Biome-formatted, hold `landing_title` and
  `landing_sign_in_status` in British English and in Danish, and leave out the name otpravkarr.
  `+page.svelte` is unchanged.
- [ ] The Weblate round trip passes all four of the spec's conditions, with the script and its
  output in the PR body. It runs here: citing obzorarr's #297 needs every file the spec lists to
  match `7368cff`, and neither hook does yet. Neither the script nor its temporary message is
  committed.
- [ ] **Test first:** `messages.test.ts` holds #301's check and cases, with otpravkarr's wording in
  the in-memory files. With `checkMessages` stubbed to return `[]`, every case that breaks a rule
  fails, and the real files and the valid pair pass (output in the PR body). With the check, all
  pass: every rule in the spec's list, each clause on its own, has an in-memory file that breaks
  only it and is reported, and a file with several problems reports them all.

**Verification:** `bun run --bun test`, `check`, `lint`, `build`, `smoke`, prek.

**Dependencies:** none.

**Files:** `package.json`, `bun.lock`, `project.inlang/settings.json`,
`project.inlang/paraglide.config.ts`, `messages/en.json`, `messages/da.json`,
`lib/shared/i18n/messages.test.ts`, `vite.config.ts`, `tsconfig.json`, `panda.config.ts`,
`.gitignore`, `AGENTS.md`, `docs/SPEC.md` (the tech-stack table, the setup fact, the Commands rows
for `bun ci` and `check`, and the testing section).

**Size:** M.

## Task 2: each request gets the viewer's language, the browser keeps it, the switcher changes it

**Description:** obzorarr's #298 and #299. Run every request through `paraglideMiddleware` in
`handle`, write the language into `<html lang>`, and keep the page's language in the browser. The
placeholder page renders its text from the messages. `LanguageSwitcher.svelte` as the spec
describes it, on the placeholder `/` and in the landing brief, with the global focus rule.

**Acceptance criteria:**
- [ ] **Test first:** `tests/e2e/i18n.test.ts`, against the built server, fails against a build of
  `main` with only the new tests, and each case fails without the code it covers (output in the PR
  body). It checks that:
  - a `da-DK` browser gets `/` in Danish with `<html lang="da">` and `Vary: Cookie,
    Accept-Language`;
  - pressing "English" from a Danish browser reloads `/` in English and writes
    `PARAGLIDE_LOCALE=en` with `SameSite=Lax` and without `Secure` over plain HTTP, and the next
    visit stays in English;
  - a browser whose header says `fr-FR` and whose `navigator.languages` an init script sets to
    `fr-FR`, `da-DK` gets English, the switcher marks English as current after hydration, pressing
    it does nothing, and no cookie is written;
  - none logs a console error. The smoke test passes unchanged in English.
- [ ] The placeholder renders its messages as text, never with `{@html}`, and keeps otpravkarr as
  it is in its wordmark and `<title>`.
- [ ] `app.html` has `<html lang="%lang%">` with the Biome suppression just above it, which doesn't
  contain the token, and keeps `class="dark"`. `hooks.server.ts` and `hooks.client.ts` are as the
  spec's Code style gives them, and the `init` hook is unchanged.
- [ ] The switcher is a labelled group of native buttons, the label a message, each button naming
  its language in that language with `lang` set, from `Intl.DisplayNames` with the first letter
  upper-cased in that language ("English", "Dansk"), through a helper private to the component,
  never a message or a literal. The current language's button has `aria-current="true"` and does
  nothing when pressed; another calls `setLocale`. It is styled only with tokens, and sits on the
  wordmark's row on `/`, wrapping below it on narrow screens.
- [ ] `panda.config.ts`'s `globalCss` has the one `:focus-visible` rule the spec gives, and
  SPEC.md's Design tokens section says so.
- [ ] The concurrency check passes: 200 concurrent requests in both languages against the built
  server, through a temporary route that awaits a random delay in its `load`, each render in their
  own language. The script and its output are in the PR body, or the body cites obzorarr's #298
  and shows that every version and file the spec lists matches `7368cff`. Neither the script nor
  the route is committed.
- [ ] The landing brief's required content names the switcher beside the wordmark, written through
  `.agents/skills/impeccable/scripts/impeccable surface-brief write`, and D16 no longer lists
  browser interaction with a real component.

**Verification:** `bun run --bun test`, `check`, `lint`, `build`, `smoke`, prek. Manual check: in
`dev`, a browser set to Danish sees the placeholder in Danish; at 360, 390, 768 and 1440 px, at
200% zoom and with reduced motion, both buttons are reachable by keyboard, focus is visible, and
pressing the current language does nothing.

**Dependencies:** task 1.

**Files:** `src/app.html`, `src/hooks.server.ts`, `src/hooks.client.ts`,
`lib/components/layout/LanguageSwitcher.svelte`, `src/routes/(public)/+page.svelte`,
`messages/en.json`, `messages/da.json`, `panda.config.ts`, `tests/e2e/i18n.test.ts`,
`.impeccable/surfaces/route.md`, `docs/decisions.md`, `AGENTS.md`, `docs/SPEC.md` (the testing
section, the Design tokens section and the `smoke` Commands row).

**Size:** M.

## Checkpoint: after task 2

- [ ] Everything passes locally and in CI (`checks`, `smoke`, `ci-ok`), and the built server serves
  and switches both languages.

## Task 3: formatting numbers and dates, and closing the work stream

**Description:** obzorarr's #300, plus the close of #301. `formatNumber` and `formatDateTime` in
`lib/shared/i18n/format.ts`, browser-safe, in the current language, with the time zone required.
This task also closes the work stream.

**Acceptance criteria:**
- [ ] **Test first:** `format.test.ts` fails before `format.ts` exists, and against each way the
  formatters could go wrong (`getLocale()` passed straight to `Intl`; the zone dropped), output in
  the PR body. It runs both inside `paraglideMiddleware` with a request for each language: `da`
  formats as `da`, and `en` as `en-GB`, with the day first and a 24-hour clock.
- [ ] `formatDateTime` follows the zone it is given, not the machine's, and its type refuses a
  call without `timeZone`. Its comments state the spec's zone rule (the zone the caller's module
  names, or `"UTC"`), not obzorarr's instance zone.
- [ ] The PR body lists every validation in the spec with its evidence or the PR that holds it.
- [ ] The end-of-work-stream cleanup is done:
  - the rest of the spec's "Docs this module changes when built" list;
  - `tasks/` is deleted;
  - SPEC-i18n.md is cut the way obzorarr's #301 cut its spec, to what code and tests can't say;
  - the PR body maps every removed requirement to a test, a spec or an owner-approved removal, with
    #301's preservation gate table.

**Verification:** `bun run --bun test`, `check`, `lint`, `build`, `smoke`, prek.

**Dependencies:** tasks 1 and 2.

**Files:** `lib/shared/i18n/format.ts`, `format.test.ts`, `docs/SPEC.md`, `docs/SPEC-i18n.md`,
`docs/decisions.md`, `PRODUCT.md`, `AGENTS.md`, `tasks/`.

**Size:** M.

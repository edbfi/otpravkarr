# Implementation plan: `setup`

## Overview

Build module 3 of the capability map as [docs/SPEC-setup.md](../docs/SPEC-setup.md) specifies:
startup checks, the database and its migrations, logging with redaction, the security headers and
CSP, the cross-origin check, and first run, which ends at the claim. Nine tasks, one PR each, each
test first, then a docs PR that ends the work stream. The tasks are in [todo.md](todo.md).

`setup` is a port: obzorarr is the reference (Shared groundwork), and its plan (obzorarr #324),
code and tests at `b59b909` are the starting point for every task. Each task starts from
obzorarr's tests for its files, renamed for otpravkarr, and adds the tests for what the spec says
differs.

## Architecture decisions

- **The riskiest part lands first.** Task 1 is D15's validation in otpravkarr: the Drizzle and
  Turso pair, the bundled migrations and Turso's native binding inside `bun ./build`. obzorarr
  found the binding can't be bundled; task 1 checks that again here and, if it still can't, ships
  the platform package beside `build/` as the spec says.
- **Forward-only migrations land with the migrator** (owner's answer, 2026-11-16). Task 1 reads
  the migration names the database has recorded before applying any, and refuses a name the build
  doesn't bundle. A test on a table the real migrator wrote, with an unknown name added, proves it
  refuses before anything is applied. obzorarr lacks it, so task 1's PR names it under "Other apps".
- **The startup service grows task by task,** as in obzorarr: task 1 creates
  `services/setup/startup.ts` with the key, the configuration and the database;
  `OTPRAVKARR_LOG_DEBUG` (task 2) and `ORIGIN` (task 4) join the configuration step, so they are
  checked before the database opens; shutdown (task 3) and first run (tasks 6 and 8) follow.
  `hooks.server.ts` only calls it.
- **Startup failures are thrown first and logged later.** Until task 2 brings the logger, a failed
  step throws from `init` exactly as the key error does now.
- **`handleError` comes with the logger** (owner's addition, 2026-11-16). obzorarr has none, so an
  unexpected error goes to SvelteKit's unredacted `console.error`. Task 2 adds the hook, so no
  later task can produce an unredacted error line.
- **The request checks come before any form.** Task 5 switches SvelteKit's form check off and puts
  the cross-origin check in its place in one PR, so `main` never has neither.
- **The fonts land before the claim page,** in their own small task (7), as obzorarr bundled its
  fonts apart from its claim page (obzorarr #313). They change the placeholder `/` too, so the smoke
  test's display text style is checked with them. This closes ground-floor choice 1.
- **The gate comes last.** Task 8 makes the claim work at `/setup` with every other page still
  served; task 9 adds the gate with the Playwright global setup that claims the instance for the
  smoke and language tests, so no PR leaves the e2e suite on an unclaimable instance.
- **Named operations join with their first caller.** Task 1 writes both tables into the first
  migration; each operation in `db/owner.ts` and `db/settings.ts` lands with its first caller.
- **The handle-built refusal page is unstyled.** Its fixed policy loads no stylesheet, and Panda's
  colours are semantic tokens with no value outside it, so the page sets only `color-scheme: dark`.
- **Signal handlers only in the built server,** so Ctrl+C still ends `dev`.
- **Generated migrations are formatted:** `db:generate` runs `biome format --write drizzle` after
  Drizzle Kit, so the shared `biome.json` stays unchanged.
- **Facts change in the task that changes them.** Each task updates the README, SPEC.md (the status
  line, the tech stack, Commands, the testing section), decisions.md and AGENTS.md's status and
  structure as its change requires, and ticks off its items here. Task 10 reduces the spec and
  deletes `tasks/`.

## Task list

### Phase 1: the foundations

- [ ] Task 1: the database (D15), forward only
- [ ] Task 2: logging with redaction, and `handleError`
- [ ] Task 3: shutdown

### Checkpoint: after task 3

- [ ] `check`, `test`, `lint`, `build`, `smoke` and prek pass; CI's `checks`, `smoke` and `ci-ok`
  pass.
- [ ] The built server migrates a new database, refuses one a newer build migrated, logs JSON
  lines, refuses a bad configuration with one line, and exits 0 on `SIGTERM` and `SIGHUP`.

### Phase 2: the request checks

- [ ] Task 4: `ORIGIN`, the security headers and the CSP
- [ ] Task 5: the cross-origin check

### Checkpoint: after task 5

- [ ] Every page and `/healthz` carry the headers; pages carry the nonce CSP with no violation.
- [ ] A cross-site POST gets the "Access denied" page, in the viewer's language.

### Phase 3: first run

- [ ] Task 6: the bootstrap token
- [ ] Task 7: the fonts
- [ ] Task 8: the claim at `/setup`
- [ ] Task 9: the setup gate

### Checkpoint: complete

- [ ] Every success criterion in SPEC-setup.md is met.

### Phase 4: closing

- [ ] Task 10: close the work stream (cleanup procedure 2)

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Turso's native binding can't be bundled, so `bun ./build` fails without `node_modules` | High | Task 1 runs the built server with `--no-install` from a folder holding only `build/`; the platform package ships beside it, as obzorarr's does |
| The record migrator doesn't work with the native driver | High | Task 1's e2e starts the built server twice on one file |
| The forward-only check reads Drizzle's migrations table wrongly, refusing a good database or passing a newer one | High | Task 1's unit tests: a new database, one at the bundled set, one with a pending migration (applies), one with an unknown name (refused before applying) |
| A rollback undoes an unrelated write on the shared connection (D5's rc.4 bug) | High | Task 1's rollback-isolation test, which must fail on `1.0.0-rc.4` |
| A newer Drizzle `rc` or Turso release than obzorarr's behaves differently | Medium | Task 1 validates the newest allowed pair here, not obzorarr's; if it fails, the PR stops for a decision |
| An unexpected error bypasses redaction | High | Task 2's `handleError` test with a token in an error's message |
| SvelteKit adds a nonce to `style-src`, which turns off `'unsafe-inline'` | Medium | Task 4's e2e listens for CSP violations on a page with style attributes |
| The token or a password reaches a log entry or a response | High | Tasks 6 and 8's e2e search the server's output and every response; task 2's redaction tests |
| Playwright's URL check wins the race against the token line | Medium | Task 9's `wait.stdout` pattern spans the token line through "Listening on" |
| Startup forgets a completed first run after a restart | High | Task 8 loads the step pointer at startup and restarts the built server on a claimed file |
| A shutdown cleanup hangs and the container is killed mid-write | Medium | Task 3's deadline test with a cleanup that never finishes; the README's `stop_grace_period` |
| A field error or a wrong token costs a hash | Medium | Task 8's unit tests prove field errors leave the token unused and wrong tokens never reach the hash |
| Timer and timing tests flake under load (obzorarr #341) | Medium | The token tests use a fake clock and the redaction tests a growth ratio, as obzorarr's do now |
| `node` sneaks into the validation | Low | Task 1 runs the gates with failing `node`, `npm` and `npx` shims on `PATH`, as CI does |

## Other apps

Each task's PR body names the sibling apps that need its change. Two are new to obzorarr: the
forward-only check (task 1), which obzorarr, comradarr, zondarr and zimuarr pick up from
otpravkarr, and `handleError` (task 2), which obzorarr's `sign-in` thread is adding there. The rest
ports obzorarr's.

## Open questions

None. The owner approved the spec on 2026-11-16 with both answers. As with `i18n`, this task list
is approved by the orchestrating session after the council's review, and merged once its review
loop ends.

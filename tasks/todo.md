# Tasks: `setup`

The spec is [docs/SPEC-setup.md](../docs/SPEC-setup.md), and the plan is [plan.md](plan.md). Each
task is one PR, starts from obzorarr's tests for its files at `b59b909` and writes its tests first.
Each one updates AGENTS.md's status and structure, ticks off its items in `tasks/`, names the
sibling apps in its PR body, gets a council review, and runs `bun run --bun check`, `test`, `lint`,
`build`, `smoke` and `prek run --all-files --hook-stage manual` before every commit. Paths under
`src/lib/server/` are shortened to `server/`.

## Task 1: the database (D15), forward only

**Description:** Add the Drizzle and Turso pair, open and migrate the database at startup, refuse a
database a newer otpravkarr migrated, and run D15's validation. Startup moves into
`server/services/setup/startup.ts`: the key, the configuration (`OTPRAVKARR_DATABASE_PATH` for
now), then the database, opened, checked and migrated. Both tables go into the first migration; no
operations yet.

**Acceptance criteria:**
- [x] `server/config/database-path.test.ts` first fails, then passes: the default against the
  working directory, an empty variable counting as unset, a folder that is created, and a folder
  that can't be created or written refused with one line naming the variable and never echoing the
  path, using a parent that is a regular file so it holds as root. `config/config-error.ts` and
  `config/error-code.ts` come with it, and `config/secret-key.ts` uses `error-code.ts` instead of
  its own copy.
- [x] `server/db/migrate.test.ts` first fails, then passes, against a temporary file: the bundled
  migrations apply to a new database, both tables exist, a second run applies nothing, and the
  rows match Drizzle Kit's file migrator by name and time, with an empty `hash`.
- [x] Forward only, in `migrate.test.ts`: `migrateDatabase` takes the migrations as a parameter that
  defaults to the bundled set. Two test migrations: a database migrated with the first, with an
  unknown name then inserted into its table, is refused when run with both, and the second's table
  and record don't exist afterwards, so nothing was applied; the message gives the spec's remedy
  ("run that version again, or restore the backup taken with this one") and neither path nor
  value. Without the unknown name, the same database applies the second.
- [x] `server/services/setup/startup.test.ts` first fails, then passes: startup opens and migrates
  the database at the path; a path that is a folder, and a file that isn't a database, are refused
  naming the variable but never the path (Turso puts the full path in its open errors).
- [x] `server/db/client.test.ts` holds D5's rollback-isolation check and fails on
  `drizzle-orm@1.0.0-rc.4`.
- [x] `drizzle-orm` and `drizzle-kit` at the newest `rc` D5 allows and `@tursodatabase/database` at
  its newest stable release, exact-pinned dev dependencies; `db:generate` runs Drizzle Kit, then
  `bun --bun biome format --write drizzle`; the first migration is generated, reviewed and
  committed.
- [x] `settings` (key, value, update time) and `owner` (a fixed id, username, password hash,
  creation time; one row at most) match the spec.
- [x] `tests/e2e/setup.test.ts` first fails, then passes: the built server, on a new temporary file,
  starts, serves `/healthz`, and starts again on the same file; it refuses to start with an
  unwritable database folder, a file that isn't a database, or a database holding an unknown
  migration, without echoing the path. `playwright.config.ts` gives each run a temporary database,
  created and removed only in the runner process, after the server exits.
- [x] D15's validation passes with its evidence in the PR body: migrations, `check`, `bun ./build`
  through the native binding on Linux arm64 (this machine) and x64 (CI's `smoke`), rollback
  isolation, and all of it with failing `node`, `npm` and `npx` on `PATH`.

**Verification:** the gates above; `bun --no-install --no-env-file ./build` from a folder holding
only `build/` (and the platform package if it must ship) opens and migrates a database.

**Dependencies:** none.

**Files:** `package.json`, `bun.lock`, `drizzle.config.ts`, `drizzle/`, `src/env.ts`,
`src/hooks.server.ts`, `server/config/{config-error,error-code,database-path}.ts` (+ test),
`server/config/secret-key.ts`, `server/db/client.ts` (+ test), `server/db/migrate.ts` (+ test),
`server/db/settings.ts`, `server/db/owner.ts`, `server/services/setup/startup.ts` (+ test),
`tests/e2e/setup.test.ts`, `playwright.config.ts`, `README.md` (the database, its backup and
`--no-install`), `docs/SPEC.md` (the status line, the tech-stack table, the `db:generate`,
`preview` and `smoke` Commands rows, the testing section, the "needs no `node_modules`" line),
`docs/decisions.md` (D15 to Decided, D5's pointer), `AGENTS.md`.

**Size:** L. One coherent unit: D15's validation needs the client, the migrator and startup
together in the built server.

## Task 2: logging with redaction, and `handleError`

**Description:** The app's own logger: four levels, one JSON line per entry on standard output,
redacted before it is written, with debug behind `OTPRAVKARR_LOG_DEBUG`. A failed startup step is
logged, then thrown. `handleError` logs every unexpected error through it.

**Acceptance criteria:**
- [x] `server/logging/redact.test.ts` first fails, then passes: obzorarr's cases at `b59b909` (each
  rule on its own and nested, encoded values up to three decodings, a bare encoded query, the
  linear-time growth checks with their retries), with the allowlist reduced to `keyId` and
  `authError`, and `ratingKey` among the names redacted.
- [x] `server/logging/logger.test.ts`: the entry's shape, one line per entry, debug dropped unless
  enabled, and `flushLogs()` through a slow pipe.
- [x] `server/config/log-debug.test.ts`: `true`, `false`, empty as unset, and anything else refused
  with one line that doesn't echo the value.
- [x] `startup.test.ts` gains: a failed step logged as one error entry, then thrown; a bad
  `OTPRAVKARR_LOG_DEBUG` refused before the database folder exists, checked with `stat` (not
  `Bun.file().exists()`, which is false for every folder).
- [x] `logUnexpectedError` in `logging/logger.ts` builds the entry for an unexpected error: one
  redacted entry with its class, message, stack, method and path without the query string; its
  cases in `logger.test.ts` (a token in the error's message comes out redacted) fail first.
  `handleError` in `src/hooks.server.ts` only calls it and returns SvelteKit's generic message.
- [x] A startup failure is one log entry and the thrown error; the built server still exits
  non-zero before it listens (`setup.test.ts` and `secret-key.test.ts` pass).
- [x] `setup.test.ts` gains: the built server with a bad `OTPRAVKARR_LOG_DEBUG` exits non-zero
  before it listens, printing one JSON error entry that doesn't contain the value.

**Verification:** the gates; the built server with a bad `OTPRAVKARR_LOG_DEBUG` prints one JSON
line.

**Dependencies:** task 1.

**Files:** `server/logging/logger.ts` (+ test), `server/logging/redact.ts` (+ test),
`server/config/log-debug.ts` (+ test), `src/env.ts`, `src/hooks.server.ts`,
`server/services/setup/startup.ts` (+ test), `tests/e2e/setup.test.ts`,
`tests/e2e/secret-key.test.ts` if the error's format changes, `README.md` (logs and
`OTPRAVKARR_LOG_DEBUG`), `docs/decisions.md` (D11 and D14's logging half), `docs/SPEC.md` (the
testing section), `AGENTS.md`.

**Size:** M.

## Task 3: shutdown

**Description:** On `SIGTERM`, `SIGINT` and `SIGHUP` (passed on to adapter-bun as `SIGTERM`), stop
the jobs and timers while the adapter drains; on `sveltekit:shutdown`, close the database, flush
the logs and exit 0, or exit non-zero after a 5-second deadline. The handlers go in only in the
built server, one turn after adapter-bun's.

**Acceptance criteria:**
- [x] `server/services/setup/startup.test.ts` gains, each failing first: the cleanup's order, the
  deadline with a cleanup that never finishes, its own entry flushed for at most 250 ms, and no
  handler in `dev`.
- [x] `setup.test.ts`: `SIGHUP` and `SIGTERM` each shut the built server down with exit code 0.
- [x] The README lists adapter-bun's `SHUTDOWN_TIMEOUT`, `CONNECTION_IDLE_TIMEOUT` and
  `BODY_SIZE_LIMIT`, and Compose's `stop_grace_period` above `SHUTDOWN_TIMEOUT` plus 5 seconds.

**Verification:** the gates; Ctrl+C still stops `bun run --bun dev`.

**Dependencies:** task 2.

**Files:** `server/services/setup/startup.ts` (+ test), `src/hooks.server.ts`,
`tests/e2e/setup.test.ts`, `README.md`, `docs/SPEC.md` (the testing section), `AGENTS.md`.

**Size:** M.

## Checkpoint: after task 3

- [x] As in [plan.md](plan.md#checkpoint-after-task-3).

## Task 4: `ORIGIN`, the security headers and the CSP

**Description:** `config/origin.ts` reads and checks `ORIGIN` at startup. `handle` gains the
headers stage after the language; SvelteKit's `csp` option sets the nonce policy on every page.
Ground-floor choice 3 closes.

**Acceptance criteria:**
- [x] `server/config/origin.test.ts` first fails, then passes: unset and a bare origin with and
  without a trailing `/` accepted; an empty value, a path (`/app/..` and `/%2e` included), query,
  fragment or credentials refused without echoing the value. `startup.test.ts` gains a bad `ORIGIN`
  refused before the database folder exists.
- [x] `server/security/headers.test.ts`: the spec's headers for HTTPS through `ORIGIN`, HTTPS
  through `Sec-Fetch-Site`, plain HTTP, `localhost`, `*.localhost` and loopback hosts, and never
  `includeSubDomains`.
- [x] `setup.test.ts`: the headers on a page, `/healthz` and a 404, no HSTS over plain HTTP; the
  policy directive for directive; the page's scripts carry the nonce and the browser reports no
  violation; the server refuses `ORIGIN=https://u:p@host` and `https://host/app` without echoing
  either.

**Verification:** the gates; `preview`'s headers checked by hand at `/` in both languages.

**Dependencies:** task 3.

**Files:** `server/config/origin.ts` (+ test), `server/security/headers.ts` (+ test), `src/env.ts`,
`src/hooks.server.ts`, `server/services/setup/startup.ts` (+ test), `vite.config.ts`,
`tests/e2e/setup.test.ts`, `README.md` (`ORIGIN`), `docs/SPEC.md` (ground-floor choice 3, the
testing section), `AGENTS.md`.

**Size:** M.

## Task 5: the cross-origin check

**Description:** `security/cross-origin.ts`, copied from obzorarr, the first check after the
language and the headers. SvelteKit's own form check goes off in the same PR. A refusal is the
"Access denied" page with its own fixed policy and `<html lang>`, or `{ message }` for JSON
callers, built by `security/access-denied.ts`.

**Acceptance criteria:**
- [x] `server/security/cross-origin.test.ts` first fails, then passes: obzorarr's matrix, with
  requests that have neither header refused (otpravkarr has no machine routes yet).
- [x] `vite.config.test.ts` (added to Vitest's `include`) asserts that the options `vite.config.ts`
  exports and passes to `sveltekit()` trust every origin and leave remote functions off.
- [x] `server/security/access-denied.test.ts`: the page in each language with its policy, and the
  JSON error.
- [x] `setup.test.ts`: a cross-site form POST gets the 403 page with the headers, its own policy and
  the viewer's language; a same-origin POST without `Sec-Fetch-*` passes the check (SvelteKit's
  405), on `localhost` and on `app.test` through Chromium's `--host-resolver-rules`, read with
  `headerValue()`.
- [x] The page's text is `error_access_denied_…` messages in both languages.

**Verification:** the gates.

**Dependencies:** task 4.

**Files:** `server/security/cross-origin.ts` (+ test), `server/security/access-denied.ts`
(+ test), `src/hooks.server.ts`, `vite.config.ts`, `vite.config.test.ts`, `messages/en.json`,
`messages/da.json`, `tests/e2e/setup.test.ts`, `README.md` (when `ORIGIN` or the proxy fix is
needed), `docs/SPEC.md` (the testing section and the `test` command), `AGENTS.md`.

**Size:** M.

## Checkpoint: after task 5

- [x] As in [plan.md](plan.md#checkpoint-after-task-5).

## Task 6: the bootstrap token

**Description:** While no owner exists, startup prints a bootstrap token to standard output with
`/setup` (the full address when `ORIGIN` is set), outside the logs, and a new one every 15
minutes. Shutdown stops the timer. First run's state is loaded into memory at startup.

**Acceptance criteria:**
- [x] `server/security/bootstrap-token.test.ts` first fails, then passes: the format and alphabet,
  unbiased drawing (a mocked byte stream), accepted with or without dashes, in any case, trimmed;
  constant-time comparison; expiry at 15 minutes.
- [x] `server/services/setup/first-run.test.ts`, against a temporary file and a fake clock: a token
  and a new one at expiry (none at 59 ms of a 60 ms lifetime, one at 60); no renewal while a claim
  is in progress; none after stopping; the full address when `ORIGIN` is set; none once claimed.
- [x] `owner.ts` gains `ownerExists`.
- [x] `startup.test.ts` gains: the signal handler stops the work (the token's timer) on `SIGTERM`
  and `SIGINT`.
- [x] `setup.test.ts`: the built server prints the token line before "Listening on"; neither form
  of the token appears in a log entry or a response.

**Verification:** the gates.

**Dependencies:** task 5.

**Files:** `server/security/bootstrap-token.ts` (+ test), `server/services/setup/first-run.ts`
(+ test), `server/services/setup/startup.ts` (+ test), `server/db/owner.ts` (+ test),
`tests/e2e/setup.test.ts`, `docs/SPEC.md` (the testing section), `AGENTS.md`.

**Size:** M.

## Task 7: the fonts

**Description:** Bundle DESIGN.md's three typefaces locally, so every page renders in them
(ground-floor choice 1). Only the weights and subsets the tokens use.

**Acceptance criteria:**
- [x] `@fontsource-variable/fraunces`, `@fontsource-variable/instrument-sans` and
  `@fontsource/ibm-plex-mono` are exact-pinned dev dependencies, imported from `src/app.css` or
  the root layout; the built server serves the font files itself, under `font-src 'self'`.
- [x] `smoke.test.ts` first fails, then passes, as obzorarr's "the bundled fonts load under the
  names Panda's font tokens give them": for each of `--fonts-display`, `--fonts-body` and
  `--fonts-mono`, `document.fonts.load()` of its first family returns at least one face
  (`document.fonts.check()` would pass a name the CSS never registers), with no request to another
  host.

**Verification:** the gates; `/` checked by hand in both languages.

**Dependencies:** task 6.

**Files:** `package.json`, `bun.lock`, `src/app.css` or `src/routes/+layout.svelte`,
`panda.config.ts` (the font tokens' families, if their names change), `tests/e2e/smoke.test.ts`,
`docs/SPEC.md` (the tech-stack table, ground-floor choice 1), `AGENTS.md`.

**Size:** S.

## Task 8: the claim at `/setup`

**Description:** The claim form and its action, in the spec's order: the fields, then the token,
then the hash, then one transaction that creates the owner and moves the step pointer. It completes
first run and sends the browser to `/`; then `/setup` and its action answer "not found". No gate
yet.

**Acceptance criteria:**
- [x] `server/security/password.test.ts` first fails, then passes: obzorarr's cases at `b59b909`
  (the limits, NFC, case, the app's name as `otpravkarr`, the username from 4 characters, the list,
  the repeat and run rule with its Unicode cases, and the argon2id round trip).
- [x] `security/common-passwords.txt` is obzorarr's file, byte for byte, with `password.ts` naming
  its source, commit and rebuild recipe.
- [x] `server/services/setup/claim.test.ts`, against a temporary file: success; a field error
  leaving the token unused; a wrong and an expired token never reaching the hash; a second claim;
  two at once leaving one owner; a failed transaction printing a new token, but none once shutdown
  has begun.
- [x] `first-run.test.ts`: a restart on a claimed database starts complete and prints nothing.
- [x] `src/routes/setup/token-format.test.ts`: the token field's dashes, caret and Backspace.
- [x] `setup.test.ts`: a wrong token refused with the spec's message, the username kept and the
  rest cleared; a token in `/setup`'s query string ignored; the right one, typed in upper case
  without dashes, claims and lands on `/`; `/setup` and its action then answer 404, also after a
  restart; neither the token nor the password appears in a response or a log entry.
- [x] The page follows `route-setup.md` through `/impeccable`, with the language switcher and
  `@lucide/svelte` (exact-pinned) eye icons beside the Show/Hide text; every string is a `setup_…`
  message in both languages. Checked at 360, 390, 768 and 1440 px, 200% zoom, the keyboard and
  reduced motion, in every state the brief names, in English and Danish, with screenshots in the PR
  body, and an Impeccable finish review.

**Verification:** the gates; a claim by hand in `preview` over plain HTTP on a LAN address.

**Dependencies:** task 7.

**Files:** `package.json`, `bun.lock`, `server/security/password.ts` (+ test),
`server/security/common-passwords.txt`, `server/services/setup/claim.ts` (+ test),
`server/services/setup/first-run.ts` (+ test), `server/db/owner.ts`, `server/db/settings.ts`
(+ tests), `src/routes/setup/` (`+page.svelte`, `+page.server.ts`, `token-format.ts` + test),
`messages/en.json`, `messages/da.json`, `tests/e2e/setup.test.ts`,
`.impeccable/surfaces/route-setup.md` (its status, through Impeccable), `DESIGN.md` if the finish
review refreshes it, `docs/SPEC.md` (the tech-stack table's icons, the testing section),
`AGENTS.md`.

**Size:** L. One coherent unit: the credential rules have no caller before the claim.

## Task 9: the setup gate

**Description:** The gate is the last stage in `handle`: until first run is complete, every request
except `/setup` and `/healthz` gets a 303 to `/setup`. Playwright's global setup claims the instance
through the form, so the smoke and language tests run on a claimed instance.

**Acceptance criteria:**
- [ ] `first-run.test.ts` gains the gate's decision for each path, before and after the claim and
  after a restart.
- [ ] `setup.test.ts`: every page sends a fresh instance to `/setup` and `/healthz` answers `ok`;
  the gate's redirect carries the headers; after a restart on a claimed file, `/` is served without
  a redirect. Earlier tests that expect a 404 or a same-origin POST's 405 claim their own servers
  first, through a `claim(server)` helper that posts the form with `Accept: text/html` (to `*/*`,
  SvelteKit answers an action in JSON); the CSP test reads `/setup`; the token-leak test reads
  `/setup` and `/healthz`, then claims and reads a 404.
- [ ] `playwright.config.ts`: `wait.stdout` from the token line through "Listening on" replaces the
  `url` check; `tests/e2e/global-setup.ts` claims through the form in a browser; `smoke.test.ts`
  and `i18n.test.ts` pass unchanged.
- [ ] The README's first run: the token in the console, `/setup`, the password rules, and who can
  claim.

**Verification:** the gates; success criterion 2 by hand over plain HTTP on a LAN address.

**Dependencies:** task 8.

**Files:** `server/services/setup/first-run.ts` (+ test), `src/hooks.server.ts`,
`tests/e2e/global-setup.ts`, `tests/e2e/setup.test.ts`, `playwright.config.ts`, `README.md`,
`docs/SPEC.md` (the testing section), `AGENTS.md`.

**Size:** M.

## Checkpoint: complete

- [ ] As in [plan.md](plan.md#checkpoint-complete).

## Task 10: close the work stream

**Description:** Cleanup procedure 2: mark `setup` built in SPEC.md, reduce SPEC-setup.md to what
code and tests can't say, update AGENTS.md's status, and delete `tasks/`. The PR body maps every
removed requirement to a test or a remaining doc.

**Acceptance criteria:**
- [ ] Every item in "Docs this module changes when built" is done.
- [ ] Nothing in SPEC-setup.md is cut without a test or doc named for it in the PR body.

**Verification:** prek (the `docs-set` hook) and CI.

**Dependencies:** task 9.

**Files:** `docs/SPEC.md`, `docs/SPEC-setup.md`, `AGENTS.md`, `tasks/` (deleted).

**Size:** S.

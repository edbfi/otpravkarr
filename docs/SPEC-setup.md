# Spec: `setup`

**Ported from obzorarr,** the reference app for `setup`
([Shared groundwork](../AGENTS.md#shared-groundwork)): its approved spec (the full text before its
cut, `0fb3565:docs/SPEC-setup.md`), its spec as built, and its code and tests at `b59b909`, which
hold the follow-ups #337–#342. Everything is the same except:
- **Names and numbers:** the `OTPRAVKARR_` prefix, `otpravkarr` in the password rule, and the
  default database `data/otpravkarr.db`. D27, D31 and D32 hold what obzorarr's D20, D26 and D27
  hold; D5, D6, D11, D14, D15 and D17 keep their numbers.
- **Owner credentials** are obzorarr's: they replace the username of 3 to 32 letters, digits,
  underscores or dashes and the password typed twice, which SPEC.md's notes carried over from the
  legacy app.
- **The redaction allowlist** keeps only the names otpravkarr's modules can log.
- **Unexpected errors** are logged through the app's logger, redacted, by a `handleError` hook
  that obzorarr's built `setup` lacks (its `sign-in` adds one; found by the comradarr port).
- **No live streams and no stored logs:** shutdown has no streams to close, and logs go only to
  standard output, since otpravkarr has no `logs` module.
- **Machine routes:** none yet; `sync` adds Dispatcharr's `m3u_refresh` webhook (D24).
- **The database path** behaves as obzorarr's: a set path with no file there creates a fresh
  database (the owner's answer; the legacy app stopped instead).
- **(otpravkarr) A database a newer otpravkarr migrated** stops startup (the owner's answer;
  [The database](#the-database)).
- **Rules with nothing to act on yet** moved to the modules that first act on them, each marked
  "moved from `setup`" in SPEC.md's Module notes: the audit trail and the request log entries to
  `sign-in`; settings, settings URLs and Plex's hosts in the CSP to `plex-connection`.
- **The claim page** has its own brief in otpravkarr's design.
- **Later first-run steps:** `two-factor`'s offer, then Plex and Dispatcharr; completing first run
  seeds `health` and lands on `/admin`.

**Status:** built (2026-11-16), module 3 of the capability map ([docs/SPEC.md](SPEC.md)); D11, D15
and D27 hold the decisions, and it closed D14's logging half and ground-floor choices 1 and 3. This
file keeps what the code and tests can't say. The full text before this cut, approved by the owner
on 2026-11-16, is `d9df389:docs/SPEC-setup.md`.

**Reading the marks.** A bullet or clause marked "(otpravkarr)" is this app's own; the rest is the
shared wording. A "(otpravkarr)" mark inside a bullet covers the rest of that bullet, and
"(otpravkarr: …)" only its own parentheses. Decision numbers are otpravkarr's.

## Objective

A fresh install starts safely and is claimed by its one owner (D27): the configuration is checked
and the database opened and migrated before any request is served; entries are logged as redacted
JSON; every state-changing request passes the cross-origin check, and every rendered response
carries the security headers and a nonce-based CSP; and until the claim, every page sends the
visitor to `/setup`, where the bootstrap token printed to the console creates the owner account.

**Left out on purpose:** signing the owner in at the claim, sessions, the browser's address, rate
limits, cookies, the error pages, the address hint and the audit trail (`sign-in`); the two-factor
offer (`two-factor`); every later first-run step. Until `sign-in` is built, a claimed instance has
no way to sign in, and first run ends at the claim ([Before `sign-in`](#before-sign-in)).

## Configuration and startup checks

Each of the app's own variables is read once, at startup, by its own file in `config/`, and
`src/env.ts` declares it (SvelteKit 3 exposes only declared variables). An empty variable counts as
unset (D31's rule; `ORIGIN` differs, below), and a failed check stops startup with one line naming
the variable and what is wrong, never echoing the value.

**adapter-bun's own variables** (`SHUTDOWN_TIMEOUT`, `CONNECTION_IDLE_TIMEOUT`, `BODY_SIZE_LIMIT`)
are read and checked by the adapter, with its own defaults and messages, which may echo a malformed
value; the app adds no code for them, and the README lists them. The container's stop timeout must
exceed `SHUTDOWN_TIMEOUT` plus the app's 5-second cleanup, so the image's Compose templates set
`stop_grace_period` (Docker's default is 10 seconds). The adapter already exempts event streams from
`CONNECTION_IDLE_TIMEOUT`. (otpravkarr: `dispatcharr-connection` sizes its interactive calls to
finish inside it; the app takes no uploads, so `BODY_SIZE_LIMIT` needs no change.)

**`ORIGIN`** is optional and never required. It is plain `ORIGIN`, not an app-prefixed name: an app
prefix would mean setting adapter-bun's `envPrefix`, which would then reject the master key's
variable. It is checked twice:
- **adapter-bun** reads it when the server module loads, before `init`, and uses it to correct
  SvelteKit's `event.url`. An empty or unparseable value stops it with the adapter's own message,
  which includes the value, so the container image's entrypoint unsets an empty `ORIGIN` and its
  templates leave it out (the image's work, not this repo's).
- **The app** then refuses what the adapter accepts and quietly trims: a path, query, fragment or
  credentials.

The cross-origin check, the strict-transport decision and `sign-in`'s browser's address all use the
one value `config/origin.ts` gives.

## Startup and shutdown

**Startup** runs once, in SvelteKit's `init` hook, before any request is served: the master key,
the configuration, the database (D5: the app is its one migration owner), then each module's
startup work in a fixed order, then the jobs. (otpravkarr: later modules add restoring the learned
quarantine names, `lineup`, and one health probe, `health`; the jobs are sync at its saved
interval, health, session cleanup and audit retention.) A job that fails to start is logged, not
fatal. A failure before the jobs is logged and thrown from `init`: the built server exits non-zero
before it listens, and the dev server stays up with every request failing.

**Shutdown.** adapter-bun drains open requests for `SHUTDOWN_TIMEOUT`, exits at once on a second
signal, and emits `sveltekit:shutdown` without waiting for its listeners. So the app stops the jobs
and timers on the signal, while the adapter drains; on `sveltekit:shutdown` it waits for those
jobs, closes the database, flushes the logs and exits 0; and it exits non-zero anyway 5 seconds
after `sveltekit:shutdown`, even with an upstream call still outstanding. `SIGHUP` counts as a stop.
(otpravkarr: there are no live streams to close.)

## The database

D5, D6 and D15 hold the engine, the access rules and the validated versions.

**Migrations** are generated by Drizzle Kit from the schema, reviewed, committed in `drizzle/` and
bundled into the build, which applies them at startup. (otpravkarr) **They only go forward.** If
the database records a migration this build doesn't bundle, a newer otpravkarr migrated it, and
startup stops before applying anything, saying to run that version again or restore the backup
taken with this one. An older build would otherwise run on a schema it doesn't know and could
enforce Dispatcharr profiles from data it misreads. The README's backup rule (a snapshot of the
database folder taken while stopped, kept with the master key and noted with the version) is what
makes the restore possible; D16 stays open for a tested restore procedure.

**Tables:**
- **`settings`:** one value per key. `setup` stores first run's step pointer here; later modules
  add their own keys.
- **`owner`:** one row at most, enforced by the schema. `two-factor`, `oidc-sign-in` (otpravkarr:
  and `plex-sign-in`'s link to the owner's Plex account) add their fields.

## Logging

D11 holds the decision and why the app has its own logger. Four levels, debug dropped unless
`OTPRAVKARR_LOG_DEBUG` is on. Each entry is one JSON line on standard output with a level, a
message, a source, structured metadata and a millisecond timestamp. (otpravkarr) Logs go only to
standard output; there are no metrics, telemetry or outbound reporting.

**Redaction** runs before an entry is written:
- credentials in URLs, and token-like query parameters, also inside a parameter's value once
  percent-decoded, as in a URL passed as a parameter;
- token, authorisation and cookie fields in payloads and headers;
- at any depth, any metadata key that looks like a token, secret, password, cookie, session or key,
  except the few names `redact.ts` lists as holding no credential, whose values are still cleaned.
  A module adds a name only when no value it can hold is a credential. (otpravkarr: the list holds
  `keyId` and `authError`; obzorarr's Plex item ids and AI token limit aren't names otpravkarr
  logs.);
- a `Secret` (`secrets`) is already `[redacted]`.

**Requests and upstream bodies** (otpravkarr): a request's query string and body are never logged,
and upstream response bodies never reach the user. The only secrets printed on purpose are the
bootstrap token and `sign-in`'s recovery token, on the console (D27).

**Unexpected errors** (otpravkarr): `handleError` writes one redacted error entry for every
unexpected error in a page load, form action or endpoint, with the method and the path without its
query string. Without it SvelteKit prints the raw stack with `console.error`, which is neither
redacted nor a JSON line. The viewer gets SvelteKit's generic message, never the error's own;
`sign-in`'s error pages choose the words. The per-request entry and the request id that ties an
error to its request come with `sign-in` (SPEC.md's `sign-in` notes).

Console output meant for whoever runs the server, such as the bootstrap token, is never a
log entry. It still reaches the container's output, which is why the console is trusted (below).

## The request checks

`handle` runs the language (`i18n`), the security headers, the cross-origin check, then the setup
gate; `sign-in` adds its stages between the cross-origin check and the gate. Every refusal is
returned, never thrown ([SPEC-i18n.md](SPEC-i18n.md#choosing-the-language)), so it keeps the
language and the headers.

### The cross-origin check

SvelteKit's own form check compares the browser's `Origin` with `event.url`, which adapter-bun
builds as `https` unless `ORIGIN` or a protocol header says otherwise, so it would refuse the claim
over plain HTTP. So that check is off, remote functions stay off (they would need `ORIGIN` too), and
the app's own check replaces it. It asks the browser, through `Sec-Fetch-Site` and `Origin` (the
rules and their order are in `cross-origin.ts` and its test matrix), so the app needs no address of
its own and stores none.

What later modules must keep:
- **Requests from no browser,** with neither `Origin` nor `Sec-Fetch-Site`, pass only on an explicit
  list of machine routes, each with the credentials the app's approved docs require for it
  (otpravkarr: none yet, so every such request is refused; `sync` adds Dispatcharr's `m3u_refresh`
  webhook with its shared-secret header, D24). The session cookie is never honoured on one: such a
  request carrying only a session cookie gets a 403.
- **The refusal** is the app's own "Access denied" page, or a JSON `{ message }` for JSON callers;
  `sign-in`'s error pages reuse its messages. Until they exist, the page is unstyled: its fixed
  policy loads no stylesheet.

**When `ORIGIN` or a proxy fix is still needed:** behind a proxy that rewrites `Host`, over plain
HTTP for every browser, and over HTTPS only for browsers without `Sec-Fetch-Site` (Safari before
16.4, Firefox before 90, Chrome before 76). The README gives the fix.

**Accepted residual risks.** Over plain HTTP, the `Origin` and `Host` comparison can't tell `http`
from `https`, which is harmless on a port that speaks only HTTP; over HTTPS it affects only
browsers without `Sec-Fetch-Site`, and only against a network attacker, and HSTS or `ORIGIN`
closes it. DNS rebinding reaches only actions that need no sign-in, because cookies don't follow a
rebind, and those are gated by a console token or rate-limited (otpravkarr: or, for Dispatcharr's
`m3u_refresh` webhook, by its shared secret, D24).

`security/cross-origin.ts` is one pure module, copied from obzorarr as D27 shares the opening
modules.

### Security headers and CSP

The headers go on every response that passes through `handle`, and the policy on every page,
through SvelteKit's `csp` option in nonce mode. No page is prerendered (`i18n` already forbids it),
so every page gets its own nonce. The choices the code can't explain:
- **`Referrer-Policy: same-origin`,** never `no-referrer`, which makes browsers send `Origin: null`
  on the app's own form posts.
- **Strict transport** only over HTTPS, known when `ORIGIN` is `https`, or, when `ORIGIN` is unset,
  from `Sec-Fetch-Site` sent to a host that isn't `localhost`, `*.localhost` or loopback, since
  browsers send it only to HTTPS and those hosts. Never `includeSubDomains`: other apps may share
  the domain. An accepted risk: HSTS covers every port of the host name, so another app on the same
  host over plain HTTP becomes unreachable from that browser until it moves to HTTPS.
- **`style-src 'unsafe-inline'`:** `src/app.html` and server-rendered pages carry style
  attributes, which a nonce can't cover, and styles can't run code.
- **A page a `handle` stage builds itself,** such as the refusal, never passes through SvelteKit's
  renderer, so the stage sets its own fixed, stricter policy and `<html lang>`.

**A limit:** responses produced before `handle` carry none of these headers: the built files, which
adapter-bun serves itself, and the adapter's own 400 and 413 answers. None is a document, so
framing and the CSP don't apply to them, and Bun sends each file with its real content type.

## First run

**The setup gate** is the last `setup` stage in `handle`. Until first run is complete, every request
except the current first-run step, `/healthz` and the responses produced before `handle` gets a 303
to that step. Sign-in and first run's own helpers join the exceptions when their modules add them.
It reads first run's state from memory, which startup loads and the claim updates (one process,
D17).

**The step pointer.** The server keeps one current-step pointer in `settings`. The browser can't
skip ahead: each step's action checks that it is the current step, a step that offers Previous only
moves the pointer back, and only the last step's action completes first run. Every step after the
claim needs the owner's session, which `sign-in` brings. (otpravkarr) Going back keeps what the
owner typed. After the claim come `two-factor`'s offer, then Plex (`plex-connection`) and
Dispatcharr (`dispatcharr-connection`); completing first run seeds `health` and lands on `/admin`,
and the setup routes then answer "not found".

**The bootstrap token** (D27) is held only in memory, printed to standard output with the path
`/setup`, and the full address when `ORIGIN` is set, since the server doesn't otherwise know its
address. A new one is printed every 15 minutes until the claim, and none after it. (otpravkarr) It
is read only from the claim form's field, so a token in the URL is ignored.

**The claim** checks the fields, then checks and uses up the token with no `await` between the
two, then hashes the password, then creates the owner and moves the step pointer in one
transaction. The cheap checks come first so a wrong guess never costs a hash, and a field error
leaves the token unused. The claim stores no address, and nothing but the owner row and the
pointer. After it, the claim no longer exists: `/setup` answers "not found" once first run is
complete (D27), and the claim action answers it whenever the instance is claimed.

**Owner credentials,** in `security/password.ts`, which `sign-in`'s password change and recovery
reuse:
- **The username** is stored with its case kept, and `sign-in` compares it after `toLowerCase()`,
  so case doesn't matter.
- **The password** needs 15 characters because that is NIST SP 800-63B-4's minimum for a password
  that is the only factor, which it is until two-factor is turned on. NIST also requires a
  blocklist, and length alone accepts the long passwords such lists hold, so the bundled list of
  common passwords is checked too, and a password that is only a repeat or a straight run is
  refused (obzorarr's owner chose the list, 2026-11-12, and the repeat and run rule, 2026-11-16).
  `password.ts` names the list's source and how to rebuild it. There are no composition rules.
- **The hash** is of the NFC form, so `sign-in` verifies what was hashed. The password is never
  logged or returned.
- **The form** has one password field with a control that shows what was typed (DESIGN.md: "a
  password field may reveal only newly typed input"), and no confirmation field.

**Trust:** anyone who can read the server console can claim a fresh install.

## Before `sign-in`

`setup` is built before `sign-in`, which brings the rest of the protections. Until then:
- **Rate limits:** none. The token has 62 bits and lasts 15 minutes, and a wrong token costs no
  hash, so guessing it isn't practical; `sign-in` adds the claim's limit (SPEC.md's `sign-in`
  notes, "Rate limits").
- **The browser's address and cookies:** the claim sets no cookie yet, so it needs neither. Once
  `sign-in` starts the owner's session at the claim, the claim needs the browser's address, and the
  session follows `sign-in`'s cookies. `sign-in` also adds the address hint to the claim page.
- **The audit trail:** `sign-in` adds it, with the claim's entry written in the claim's transaction
  (SPEC.md's `sign-in` notes).
- **First run ends at the claim,** its only step: the claim completes first run and sends the
  browser to `/`, which is still the placeholder page. `sign-in` signs the new owner in at the
  claim, and `two-factor` adds the first step after it, from which on the claim no longer completes
  first run.

No release is cut between `setup` and `sign-in`.

## Boundaries

- **Always:** startup finishes before the first request; reviewed migrations, only forward; named
  database operations and short transactions (D6); redaction before writing; the token only in
  memory and on the console; the cheap checks before the hash; refusals in `handle` returned, never
  thrown.
- **Ask first:** another database engine; a logging library; a second owner or any role (D27).
- **Never:** a token or password in a log entry, response or the database (only the hash); a stored
  address; a way to skip a first-run step; a claim after first run; `includeSubDomains`.

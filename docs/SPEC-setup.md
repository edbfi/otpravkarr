# Spec: `setup`

**Ported from obzorarr,** the reference app for `setup`
([Shared groundwork](../AGENTS.md#shared-groundwork)): its approved spec (the full text before its
cut, `0fb3565:docs/SPEC-setup.md`), its spec as built, and its code and tests at `b59b909`, which
hold the follow-ups #337–#342. Everything is the same except:
- **Names and numbers:** the `OTPRAVKARR_` prefix, `otpravkarr` in the password rule, and the
  default database `data/otpravkarr.db`. D27, D31 and D32 hold what obzorarr's D20, D26 and D27
  hold; D5, D6, D11, D14, D15 and D17 keep their numbers.
- **The audit trail** moves from `setup` to `sign-in` ([Moved out of `setup`](#moved-out-of-setup)).
- **Owner credentials** are obzorarr's: they replace the username of 3 to 32 letters, digits,
  underscores or dashes and the password typed twice, which SPEC.md's notes carried over from the
  legacy app.
- **The redaction allowlist** keeps only the names otpravkarr's modules can log.
- **Unexpected errors** are logged through the app's logger, redacted, by a `handleError` hook
  that obzorarr's built `setup` lacks (its `sign-in` adds one; found by the comradarr port). The
  per-request entry, and the request id that ties an error to it, come with `sign-in`, which knows
  the client address.
- **No live streams and no stored logs:** shutdown has no streams to close, and logs go only to
  standard output, since otpravkarr has no `logs` module.
- **Machine routes:** none yet; `sync` adds Dispatcharr's `m3u_refresh` webhook (D24).
- **The database path** behaves as obzorarr's: SPEC.md's note that an explicitly set path that
  doesn't exist stops the built server, carried over from the legacy app, is dropped, because it
  would stop every first start at a path the image or the admin sets.
- **(otpravkarr) A database a newer otpravkarr migrated** stops startup
  ([Migrations](#migrations)).
- **Rules with nothing to act on yet** move to the modules that first act on them: settings URLs
  and secret settings to `plex-connection`, and Plex's hosts in the CSP to the module that first
  needs them in the browser, with their note kept among `plex-connection`'s until then.
- **The claim page** has its own brief in otpravkarr's design, and as otpravkarr's first real
  surface it brings the fonts and the icon family ([Dependencies](#dependencies)).
- **Later first-run steps:** `two-factor`'s offer, then Plex and Dispatcharr; completing first run
  seeds `health` and lands on `/admin`.

**Status:** approved by the owner (2026-11-16), with the capability-map changes and the new
dependencies below; a set database path with no file creates a fresh database, and a database a
newer otpravkarr migrated stops startup (the owner's answers). Module 3 of the capability map
([docs/SPEC.md](SPEC.md)); it closes D15, the logging half of D14, ground-floor choices 1 (the
fonts) and 3, and `setup`'s line in "Open decisions each module closes".

**Reading the marks.** A bullet or clause marked "(otpravkarr)" is this app's own; the rest is the
shared wording. A "(otpravkarr)" mark inside a bullet covers the rest of that bullet, and
"(otpravkarr: …)" only its own parentheses. Decision numbers are otpravkarr's.

## Objective

A fresh install starts safely and is claimed by its one owner (D27):
1. **Startup:** the configuration is checked, the database opened and migrated, and each module's
   startup work run, before any request is served; shutdown stops work, drains and closes cleanly.
2. **The database** (D5, D6): embedded Turso through Drizzle, with reviewed migrations, a settings
   store and the owner account.
3. **Logging** (D11): structured entries on standard output, redacted before they are written.
4. **The request checks:** the cross-origin check on every state-changing request, and security
   headers and a nonce-based CSP on every response the app renders (ground-floor choice 3).
5. **First run:** the setup gate, the bootstrap token printed to the console, and the claim, which
   creates the owner account.

**Left out on purpose:** signing the owner in at the claim, sessions, the browser's address, rate
limits, cookies, the error pages, the address hint and the audit trail (`sign-in`); the two-factor
offer (`two-factor`); every later first-run step. Until `sign-in` is built, a claimed instance has
no way to sign in, and first run ends at the claim ([Before `sign-in`](#before-sign-in)).

## Configuration and startup checks

Each of the app's own variables is read once, at startup, by its own file in `config/`, and
`src/env.ts` declares it (SvelteKit 3 exposes only declared variables). For these, an empty variable
counts as unset (D31's rule; `ORIGIN` differs, below), and a check that fails stops startup with one
line naming the variable and what is wrong, never echoing the value.

| Variable | Default | Checked |
|---|---|---|
| `OTPRAVKARR_SECRET_KEY`, `…_FILE` | — | as `secrets` checks them (D31) |
| `OTPRAVKARR_DATABASE_PATH` | `data/otpravkarr.db`, against the working directory | its folder exists or can be created, and is writable |
| `ORIGIN` | unset | below |
| `OTPRAVKARR_LOG_DEBUG` | off | `true` or `false` |

**adapter-bun's own variables** are read and checked by the adapter (1.0.1), with its own defaults
and messages, which may echo a malformed value; the app adds no code for them, and the README lists
them:
- `SHUTDOWN_TIMEOUT` (default 30 s): the drain time. The container's stop timeout must exceed it
  plus the app's 5-second cleanup; the README says so, and the image's Compose templates set
  `stop_grace_period` (Docker's default is 10 seconds);
- `CONNECTION_IDLE_TIMEOUT` (default 10 s, at most 255 s; 0 turns it off): the idle timeout. The
  adapter already exempts event streams. `dispatcharr-connection` sizes its interactive calls to
  finish inside it;
- `BODY_SIZE_LIMIT` (default 512 KB, with unit suffixes or `Infinity`) (otpravkarr: takes no
  uploads, so it needs no change).

**`ORIGIN`** is optional and never required. It is plain `ORIGIN`, not an app-prefixed name: an app
prefix would mean setting adapter-bun's `envPrefix`, which would then reject the master key's
variable. When set, it is a bare `http` or `https` origin (a trailing `/` is fine), compared as a
parsed origin. It is checked twice:
- **adapter-bun 1.0.1** reads it when the server module loads, before `init`, and uses it to
  correct SvelteKit's `event.url`. An empty or unparseable value stops it with the adapter's own
  message, which includes the value, so the container image's entrypoint unsets an empty `ORIGIN`
  and its templates leave it out (the image's work, not this repo's).
- **The app** then refuses what the adapter accepts and quietly trims: a path, query, fragment or
  credentials. Startup stops with an error that doesn't echo the value. An empty `ORIGIN` is
  refused too, since the adapter refuses it first.

The cross-origin check, the strict-transport decision and `sign-in`'s browser's address all use the
one value `config/origin.ts` gives.

## Startup and shutdown

**Startup** runs once, in SvelteKit's `init` hook, before any request is served, and is skipped
while building:
1. the master key (`secrets`, as now);
2. the configuration above;
3. the database: opened, then migrated (D5: the app is its one migration owner);
4. each module's startup work, in a fixed order. `setup`'s own: load first run's state, and if the
   instance is unclaimed, print the bootstrap token. (otpravkarr: later modules add restoring the
   learned quarantine names, `lineup`, and one health probe, `health`);
5. starting the jobs (none yet; otpravkarr: later sync at its saved interval, health, session
   cleanup and audit retention). A job that fails to start is logged, not fatal.

A failure in steps 1–4 is logged and thrown from `init`: the built server exits non-zero before it
listens, and the dev server stays up with every request failing, as the key error already does.

**Shutdown.** adapter-bun 1.0.1 already drains open requests for `SHUTDOWN_TIMEOUT`, then closes
the rest, exits at once on a second signal, and emits `sveltekit:shutdown` without waiting for its
listeners. The app adds, in the built server only (so Ctrl+C still ends `dev`):
- **On the signal** (`SIGTERM`, `SIGINT`, and `SIGHUP`, which counts as a stop and is passed on to
  the adapter as `SIGTERM`): stop the jobs and timers, the bootstrap token's included, while the
  adapter drains. (otpravkarr: there are no live streams to close.)
- **On `sveltekit:shutdown`:** wait for the jobs stopped on the signal, close the database, then
  flush the logs (so a closing error is written) and exit 0.
- **A deadline:** if that cleanup hasn't finished 5 seconds after `sveltekit:shutdown`, the app
  exits non-zero anyway, even with an upstream call still outstanding.

## The database

**Versions:** `drizzle-orm` and `drizzle-kit` on the `rc` dist-tag, at the newest release D5 allows,
and `@tursodatabase/database` on its newest stable release (D5, D32; obzorarr validated `1.0.0-rc.5`
with `0.8.3`), exact-pinned dev dependencies. The build validates the pair in otpravkarr
([Validation](#validation)), which closes D15; obzorarr's result is evidence, not proof.

**Access** follows D6: the client in `db/client.ts` opens the one file; each aggregate's file in
`db/` holds its tables and its named operations; services own the transactions, and every statement
in one goes through its transaction object.

### Migrations

Drizzle Kit generates them from the schema (`bun run --bun db:generate`, which then formats its
output with Biome), and they are reviewed and committed in `drizzle/`. The built server applies them
at startup with only `build/` and the database file: Vite bundles each migration's SQL
(`import.meta.glob` with `?raw`), and Drizzle's record migrator for Turso applies them. Pending
migrations apply in order, each once, as one all-or-nothing batch.

**(otpravkarr) They only go forward.** Before applying anything, startup reads the migrations the
database has recorded. If it holds one this build doesn't bundle, a newer otpravkarr migrated it,
and startup stops with a message that says so: run that version again, or restore the backup taken
with this one. An older build would otherwise run on a schema it doesn't know and could enforce
Dispatcharr profiles from data it misreads. The README tells the owner that a backup is a coherent
snapshot of the database folder taken while otpravkarr is stopped, kept with the master key (D16,
D31) and noted with the version that wrote it.

### Tables

Each comes with `drizzle/`'s first migration:
- **`settings`:** key, value (text) and update time, through named operations to read and write a
  key. One value per key; a write replaces it. `setup` stores first run's step pointer here; later
  modules add their own keys.
- **`owner`:** one row at most, enforced by the schema (a fixed id): username, password hash and
  creation time. `two-factor`, `oidc-sign-in` (otpravkarr: and `plex-sign-in`'s link to the owner's
  Plex account) add their fields.

## Logging

Four levels, debug dropped unless `OTPRAVKARR_LOG_DEBUG` is on. Each entry is one JSON line on
standard output (D11) with a level, a message, a source, structured metadata and a millisecond
timestamp. `logging/` is the app's own small logger, with no library, which closes D14's logging
half: the redaction rules below need key matching at any depth that path-based library redaction
doesn't give, and the entry's shape is fixed here. (otpravkarr) Logs go only to standard output;
there are no metrics, telemetry or outbound reporting.

**Redaction** runs before an entry is written:
- credentials in URLs, and token-like query parameters, also inside a parameter's value once
  percent-decoded (up to three times), as in a URL passed as a parameter; such a value is redacted
  whole;
- token, authorisation and cookie fields in payloads and headers;
- at any depth, any metadata key that looks like a token, secret, password, cookie, session or key,
  except the few names `redact.ts` lists as holding no credential, whose values are still cleaned
  like any other. (otpravkarr: the list holds `keyId`, the keyring's key fingerprint, and
  `authError`, an authentication error's message; obzorarr's Plex item ids and AI token limit
  aren't names otpravkarr logs. A module adds a name only when no value it can hold is a
  credential.);
- a `Secret` (`secrets`) is already `[redacted]`.

**Requests and upstream bodies** (otpravkarr): a request's query string and body are never logged,
and upstream response bodies never reach the user. The only secrets printed on purpose are the
bootstrap token and `sign-in`'s recovery token, on the console (D27).

**Unexpected errors** (otpravkarr: obzorarr's built `setup` has no such hook): `handleError` in
`hooks.server.ts` writes one error entry through the logger for every unexpected error in a page
load, form action or endpoint, with the error's class, message and stack, the method and the path
without its query string, all redacted. Without it SvelteKit prints the raw stack with
`console.error`, which is neither redacted nor a JSON line. It returns SvelteKit's generic message,
never the error's own; `sign-in`'s error pages choose the words the viewer sees.

**Request entries** (otpravkarr) come with `sign-in`: one entry per request (method, the path
without its query string, status, duration, client address), and a request id that ties an error
entry to its request. Jobs and the health probe log their own entries when they come.

Console output meant for whoever runs the server, such as the bootstrap token, is never a log
entry. It still reaches the container's output, which is why the console is trusted (below).

## The request checks

`handle` runs its stages in this order: the language (`i18n`), the security headers, the
cross-origin check, then the setup gate. `sign-in` later adds its stages between the cross-origin
check and the gate. Every refusal is returned, never thrown
([SPEC-i18n.md](SPEC-i18n.md#choosing-the-language)), so it keeps the language and the headers.

### The cross-origin check

Brought forward from `sign-in`'s Module notes, because the claim is the first form: SvelteKit's own
check compares the browser's `Origin` with `event.url`, which adapter-bun builds as `https` unless
`ORIGIN` or a protocol header says otherwise, so it would refuse the claim over plain HTTP.
- **SvelteKit's own form check is off:** `sveltekit({ csrf: { trustedOrigins: ['*'] } })` in
  `vite.config.ts` (SvelteKit 3 takes its options in the `sveltekit()` call, with no `kit:`
  wrapper). Remote functions stay off. A config test asserts both, so SvelteKit's only remaining
  check before `handle` is the remote-function one, which nothing uses. The cross-origin check
  replaces SvelteKit's form check.
- **The cross-origin check** asks the browser, so the app doesn't need to know its own address and
  stores none. It is the first check in `handle`, after only the language (`i18n`) and the
  headers, for every method except GET, HEAD and OPTIONS, and for every content type (form, JSON,
  multipart, `text/plain`, empty). Internal `event.fetch` subrequests (`event.isSubRequest`) skip
  it.
  - An `Origin` header, whenever it is present, must parse as one bare `http` or `https` origin;
    `null`, a malformed value or several values are refused. This applies on every branch below.
  - With `ORIGIN` set, a present `Origin` must equal `ORIGIN`, compared as parsed origins. Without
    `Origin`, `Sec-Fetch-Site` must be `same-origin` or `none`.
  - With `ORIGIN` unset, a present `Sec-Fetch-Site` passes only as `same-origin` or `none`
    (`same-site` and `cross-site` are refused). Otherwise `Origin`'s host and port must equal the
    `Host` header, with default ports normalised. Browsers send `Sec-Fetch-Site` only to HTTPS,
    `localhost` and loopback addresses, so over plain HTTP outside loopback every browser gets
    this comparison.
  - A request with neither `Origin` nor `Sec-Fetch-Site` doesn't come from a browser. It passes only
    on an explicit list of machine routes: the API-key endpoints and other machine routes the app's
    approved docs already name, each with the credentials those docs require. (otpravkarr: none
    yet, so every such request is refused; `sync` adds Dispatcharr's `m3u_refresh` webhook with
    its shared-secret header, D24.) The session cookie is never honoured on it: such a request
    that carries only a session cookie gets a 403.
  - A refusal is a 403 with the app's own "Access denied" page, or a JSON error (`{ message }`)
    for JSON callers, with the security headers and in the viewer's language. Until `sign-in`
    builds the error pages, the page is the title and its one-line description, unstyled: its
    fixed policy (below) loads no stylesheet, so it sets only `color-scheme: dark`.
- **When `ORIGIN` or a proxy fix is still needed:** behind a proxy that rewrites `Host`, over plain
  HTTP for every browser, and over HTTPS only for browsers without `Sec-Fetch-Site` (Safari before
  16.4, Firefox before 90, Chrome before 76). The proxy fix is `proxy_set_header Host $http_host`
  (not `$host`, which drops a non-default port). Remote functions would need it too; they stay
  off.
- **Accepted residual risks.** Over plain HTTP, the `Origin` and `Host` comparison can't tell `http`
  from `https`, which is harmless on a port that speaks only HTTP; over HTTPS it affects only
  browsers without `Sec-Fetch-Site`, and only against a network attacker, and HSTS or `ORIGIN`
  closes it. DNS rebinding reaches only actions that need no sign-in, because cookies don't follow
  a rebind, and those are gated by a console token or rate-limited (otpravkarr: or, for
  Dispatcharr's `m3u_refresh` webhook, by its shared secret, D24).

`security/cross-origin.ts` is one pure module, copied from obzorarr as D27 shares the opening
modules.

### Security headers and CSP

On every response that passes through `handle`, early returns, the setup gate's redirect and error
pages included:
- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: same-origin` (never `no-referrer`, which makes browsers send `Origin: null` on
  the app's own form posts);
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`;
- `Strict-Transport-Security: max-age=31536000` over HTTPS only, known when `ORIGIN` is `https`, or
  when `ORIGIN` is unset and the browser sent `Sec-Fetch-Site` to a host that isn't `localhost`,
  `*.localhost` or a loopback address (`127.0.0.0/8`, `[::1]`), since browsers send it only to
  HTTPS and those hosts. Never `includeSubDomains`: other apps may share the domain. An accepted
  risk: HSTS covers every port of the host name, so another app on the same host over plain HTTP
  becomes unreachable from that browser until it moves to HTTPS.

**The content security policy** goes on every page through SvelteKit's `csp` option in
`vite.config.ts`, in nonce mode:
- `default-src 'self'`, so a directive not listed falls back to the app;
- `script-src 'self'` with the nonce, so only the app's scripts run;
- `style-src 'self' 'unsafe-inline'`: `src/app.html` and server-rendered pages carry style
  attributes (Svelte and Ark UI write some), which a nonce can't cover, and styles can't run code.
  This answers the open decision on inline style attributes;
- `img-src 'self' data:`;
- `font-src 'self'` (DESIGN.md bundles the fonts);
- `connect-src 'self'`;
- `frame-ancestors 'none'`, `frame-src 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`.

No page is prerendered (`i18n` already forbids it), so every page gets its own nonce.

**A page a `handle` stage builds itself,** such as the cross-origin refusal, never passes through
SvelteKit's renderer, which adds the policy above and fills `<html lang>`. The stage sets both
itself, with a fixed, stricter policy, since the page has no scripts: `default-src 'none';
style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`.

**A limit:** responses produced before `handle` carry none of these headers: the built files
(scripts, styles, fonts), which adapter-bun serves itself, and the adapter's own 400 and 413
answers. None is a document, so framing and the CSP don't apply to them, and Bun sends each file
with its real content type. This answers the open decision on responses sent before `handle`.

## First run

**The setup gate** is the last `setup` stage in `handle`. Until first run is complete, every request
except the current first-run step, `/healthz` and the responses produced before `handle` gets a
303 to that step (sign-in and first run's own helpers join the exceptions when their modules add
them). It reads first run's state from memory, which startup loads and the claim updates (one
process, D17).

**The step pointer.** The server keeps one current-step pointer in `settings`. The browser can't
skip ahead: each step's action checks that it is the current step, a step that offers Previous only
moves the pointer back, and only the last step's action completes first run. Every step after the
claim needs the owner's session, which `sign-in` brings. (otpravkarr) Going back keeps what the
owner typed. After the claim come `two-factor`'s offer, then Plex (`plex-connection`) and
Dispatcharr (`dispatcharr-connection`); completing first run seeds `health` and lands on `/admin`,
and the setup routes then answer "not found".

**The bootstrap token** (D27):
- 12 random lowercase letters and digits, drawn without bias from WebCrypto, shown as
  `xxxx-xxxx-xxxx`;
- held only in memory: never in a log entry, the database or a response;
- printed to standard output at startup with the path `/setup`, and the full address when `ORIGIN`
  is set (the server doesn't otherwise know its address);
- valid for 15 minutes, after which a new one is printed; a timer that shutdown stops, and that
  waits while a claim is in progress;
- entered with or without the dashes, in any case, with spaces around it trimmed, and compared in
  constant time; (otpravkarr) only from the claim form's field, so a token in the URL is ignored;
- once the instance is claimed, none is printed again.

**The claim** is `/setup`, the first step, and a POST form action. In this order:
1. **The fields:** after the form is read, the username and password are checked against the rules
   below, with nothing awaited. A field error leaves the token unused.
2. **The token:** checked and used up, with no `await` between the two. A wrong or expired token
   gets one error, "That setup token isn't valid. Use the newest one printed in the server
   console.", and never reaches the hash, so a guess costs the server nothing.
3. **The hash** of the password.
4. **One transaction** creates the owner and moves the step pointer; its insert fails if an owner
   exists.

If anything after the token is used up fails while the instance is still unclaimed (and not shutting
down), a new token is printed. A failed claim keeps the typed username and clears the token and
password. The claim stores no address, and nothing but the owner row and the pointer.

**After it,** the claim no longer exists: `/setup` answers "not found" once first run is complete
(D27), and the claim action answers it whenever the instance is claimed.

**Owner credentials,** in `security/password.ts`, which `sign-in`'s password change and recovery
reuse. This answers `sign-in`'s open decision on the password rules, since the claim sets the first
password; `sign-in` keeps how repeated failed sign-ins are slowed.
- **Username:** trimmed and normalised to Unicode NFC, then 1–64 characters (Unicode code points),
  no control characters (`\p{Cc}`). Stored in that form, case kept, and compared after
  `toLowerCase()`, so case doesn't matter.
- **Password:** normalised to NFC, then 15–128 characters (Unicode code points), any characters,
  no composition rules. It may not contain, ignoring case, the app's name or, when the username has
  4 or more characters, the username; it may not be on the bundled list of common passwords
  (below); and it may not be, as a whole, one unit of up to 4 characters repeated or one straight
  run up or down (each code point lower-cased on its own). 15 is NIST SP 800-63B-4's minimum for a
  password that is the only factor, which it is until two-factor is turned on.
- **The common-password list,** `security/common-passwords.txt`, copied from obzorarr: the entries
  of 15 or more characters from one file of SecLists' `Passwords/Common-Credentials/` (MIT
  licence), whose path, commit and rebuild recipe `password.ts` names. Vite bundles it with `?raw`,
  like the migrations. It is compared after NFC and lower-casing. NIST requires checking a
  blocklist, and length alone accepts the long passwords such lists hold (obzorarr's owner chose
  the list, 2026-11-12, and the repeat and run rule, 2026-11-16).
- **Hashing:** `Bun.password` with argon2id and Bun's defaults, of the NFC form, so `sign-in`
  verifies what was hashed. The password is never logged or returned.
- **The form** has one password field with a Show/Hide control (DESIGN.md: "a password field may
  reveal only newly typed input"), and no confirmation field.
- **There is never a second owner** (D27).

**Trust:** anyone who can read the server console can claim a fresh install.

## Before `sign-in`

`setup` is built before `sign-in`, which brings the rest of the protections. Until then:
- **Rate limits:** none. The token has 62 bits and lasts 15 minutes, and a wrong token costs no
  hash, so guessing it isn't practical; `sign-in` adds the claim's limit (SPEC.md's `sign-in` notes,
  "Rate limits").
- **The browser's address and cookies:** the claim sets no cookie yet, so it needs neither. Once
  `sign-in` starts the owner's session at the claim, the claim needs the browser's address, and the
  session follows `sign-in`'s cookies. `sign-in` also adds the address hint to the claim page.
- **The audit trail:** `sign-in` adds it, with the claim's entry ([Moved out of
  `setup`](#moved-out-of-setup)).
- **First run ends at the claim,** its only step: the claim completes first run and sends the
  browser to `/`, which is still the placeholder page. `sign-in` signs the new owner in at the
  claim, and `two-factor` adds the first step after it, from which on the claim no longer completes
  first run.

No release is cut between `setup` and `sign-in`.

## Moved out of `setup`

(otpravkarr) The capability map and SPEC.md's `setup` notes give `setup` some rules with nothing to
act on in it. They move, with only the wording their new home needs, to the first module that acts
on them; the owner approves the moves with this spec, and the capability map changes with it:
- **The audit trail** moves to `sign-in` (rows 3 and 4, and "Where modules live"). It needs the
  client address and an actor, which `sign-in` brings; its first writers after the claim, owner
  sign-in and sign-out, are `sign-in`'s; and no release is cut in between, so the claim is audited
  from the first release. `sign-in` adds the table, the one write service and the claim's entry,
  written in the claim's transaction.
- **Settings URLs** and **secret settings** (encrypted, their field blank after saving, and how a
  cleared secret is stored, which must keep SPEC-secrets.md's `NULL` for none) move to
  `plex-connection`, the first connection form; `dispatcharr-connection` follows the same URL rule
  and keeps its public-URL rule. Whichever of the two is built first builds the shared URL rule.
- **Plex's hosts in the CSP** (`img-src` for avatars, `connect-src`) are added by the module that
  first needs them in the browser; their note waits among `plex-connection`'s.
- **The request log entries,** and the request id on error entries, move to `sign-in`
  ([Logging](#logging)); `setup` keeps `handleError`, which logs unexpected errors.

## Validation

The build runs D15's validation in otpravkarr with the pinned versions, and records the evidence in
its PR body:
- **Migrations:** Drizzle Kit generates the first migration from the schema; the built server
  applies the bundled migrations to a new database, records them with the names and times Drizzle
  Kit's own migrator would, with an empty `hash` where it writes a SHA-256 (a unit test compares the
  two), and on a second start finds nothing to apply.
- **Type checking:** `check` passes with the schema, client and operations.
- **The production build:** `bun ./build` opens the database through Turso's native binding on
  Linux x64 and arm64. Where the binding can't be bundled (obzorarr found it can't), the platform's
  package ships beside the build, the README starts the server with `--no-install`, and SPEC.md's
  "`bun ./build` needs no `node_modules`" says so.
- **Rollback isolation** (D5): a transaction that rolls back leaves a concurrent, unrelated write on
  the same connection in place.
- **No Node:** all of it with no `node`, `npm` or `npx` on `PATH`.

## Dependencies

The owner approves these with this spec (AGENTS.md's "Ask first: new dependencies"), each an
exact-pinned dev dependency at its newest release (D32):
- `@tursodatabase/database`, `drizzle-orm` and `drizzle-kit` (D5, D15);
- the fonts DESIGN.md names, bundled locally (ground-floor choice 1: the first surface adds them):
  `@fontsource-variable/fraunces`, `@fontsource-variable/instrument-sans` and
  `@fontsource/ibm-plex-mono`, importing only the weights and subsets the tokens use;
- `@lucide/svelte`, the one line icon family DESIGN.md asks for ("a single consistent 20px line
  family"), first used by the password field's Show/Hide control, with its text label kept.

## Project structure

```text
src/env.ts                                  + OTPRAVKARR_DATABASE_PATH, ORIGIN, OTPRAVKARR_LOG_DEBUG
src/hooks.server.ts                         init: startup; handle: language, headers,
                                            cross-origin check, setup gate; handleError
src/app.css                                 + the bundled fonts
src/lib/server/config/config-error.ts       the error every variable check throws
src/lib/server/config/error-code.ts         a system error's code, for messages without paths
src/lib/server/config/database-path.ts      the database file's path
src/lib/server/config/origin.ts             ORIGIN, parsed and checked
src/lib/server/config/log-debug.ts          OTPRAVKARR_LOG_DEBUG
src/lib/server/db/client.ts                 opens the database
src/lib/server/db/migrate.ts                applies the bundled migrations, forward only
src/lib/server/db/settings.ts               the settings table and its operations
src/lib/server/db/owner.ts                  the owner table and its operations
src/lib/server/logging/logger.ts            levels, entries, standard output
src/lib/server/logging/redact.ts            the redaction rules
src/lib/server/security/access-denied.ts    the cross-origin refusal: the page or JSON
src/lib/server/security/bootstrap-token.ts  the token: drawing, formatting, comparing, expiry
src/lib/server/security/cross-origin.ts     the cross-origin check
src/lib/server/security/headers.ts          the security headers for a request
src/lib/server/security/password.ts         the credential rules, hashing and verifying
src/lib/server/security/common-passwords.txt
src/lib/server/services/setup/startup.ts    the startup steps and shutdown
src/lib/server/services/setup/first-run.ts  the steps, the pointer and the gate's decision
src/lib/server/services/setup/claim.ts      the claim
src/routes/setup/+page.svelte               the claim form
src/routes/setup/+page.server.ts            its load and the claim action
src/routes/setup/token-format.ts            the token field's dashes as it is typed
drizzle/                                    the reviewed migrations
drizzle.config.ts
vite.config.test.ts                         SvelteKit's form check and remote functions stay off
tests/e2e/setup.test.ts                     first run and the request checks on the built server
tests/e2e/global-setup.ts                   claims the instance for the other tests
```

The build also changes `package.json` (the dependencies above and `db:generate`), `vite.config.ts`
(the exported SvelteKit options with the form check off and the CSP, and Vitest's `include`),
`playwright.config.ts` (a temporary database per run, the token captured from the server's output,
the global setup), `messages/` (the claim page's text, `setup_…`, and the refusal's,
`error_access_denied_…`, which `sign-in`'s error pages reuse), the README (the variables, the
database and its backup, the address browsers use, first run, logs, and stopping) and
`.gitignore` (already ignores `/data/` and `*.db*`).

The claim page follows its brief, [`route-setup.md`](../.impeccable/surfaces/route-setup.md), and
shows the language switcher.

## Testing strategy

Ported from obzorarr's tests, with otpravkarr's names.
- **Unit (Vitest, `node`):**
  - each `config/` reader;
  - the redaction rules, one case each and nested, the allowlist, encoded values, and growth checks
    that catch a scan slower than linear;
  - the headers for HTTPS, plain HTTP, loopback and `ORIGIN`;
  - the cross-origin check against a matrix of methods, content types and `Origin`,
    `Sec-Fetch-Site`, `Host` and `ORIGIN` values, the refusal page and JSON in both languages, and
    the config test for SvelteKit's options;
  - the token's format, alphabet, expiry and comparison, with timers on a fake clock;
  - the credential rules at their limits, NFC, case, the repeat and run rule and the list;
  - the shutdown deadline with a cleanup that never finishes;
  - `handleError`: an error holding a token in its message becomes one redacted JSON entry with its
    class, stack, method and path, and the viewer gets SvelteKit's generic message;
  - against a temporary database file: migrations on a new database, nothing applied twice, the
    two migrators' records compared, rollback isolation, (otpravkarr) a database holding a
    migration the build doesn't bundle refused before anything is applied; and the claim: success;
    a field error leaving the token unused; a wrong and an expired token never reaching the hash; a
    second claim; two at once leaving one owner; a failed transaction printing a new token; a
    restart reading the instance back as claimed; and the gate's decision for each path.
- **e2e (Playwright, against the built server):** the web server starts with a generated key and a
  temporary database. Its `wait.stdout` pattern runs from the token line through adapter-bun's
  "Listening on" and replaces the `url` check, because Playwright races the two and the URL could
  win before the token is captured. The global setup claims the instance through the form in a
  browser, so the smoke and language tests run on a claimed instance as before. The temporary
  database is removed once the server process has exited, which is after the global teardown.
  `setup.test.ts` starts its own fresh servers and checks that:
  - a new database is migrated, and a second start applies nothing;
  - every page sends a fresh instance to `/setup`, and `/healthz` still answers `ok`;
  - a wrong token is refused, the right one claims, and `/setup` then answers 404, also after a
    restart; (otpravkarr) a token in `/setup`'s query string is ignored;
  - a cross-site form POST is refused, and a same-origin POST with no `Sec-Fetch-*` headers passes,
    both on `localhost` and on a plain-HTTP host name that isn't loopback (Chromium's
    `--host-resolver-rules="MAP app.test 127.0.0.1"`);
  - the headers are on a page, `/healthz`, a 404, a refusal and the gate's redirect, and HSTS isn't,
    over plain HTTP;
  - the page's scripts carry the CSP nonce, the refusal page carries its own policy, and the
    browser reports no CSP violation;
  - the server refuses to start with an `ORIGIN` holding credentials (`https://u:p@host`) or a path
    (`https://host/app`), with a bad `OTPRAVKARR_LOG_DEBUG`, or with an unwritable database folder,
    without echoing any of them;
  - `SIGHUP` and `SIGTERM` each shut it down with exit code 0;
  - the token and the password never appear in a response or a log entry.

## Commands

The ground floor's ([docs/SPEC.md](SPEC.md#commands)), plus `bun run --bun db:generate` (Drizzle
Kit generates a migration from the schema, then Biome formats it). `smoke` also runs
`setup.test.ts`, and `preview` starts the built server with `--no-install` if the binding ships
beside it.

## Boundaries

- **Always:** startup finishes before the first request; reviewed migrations, only forward; named
  database operations and short transactions (D6); redaction before writing; the token only in
  memory and on the console; the cheap checks before the hash; refusals in `handle` returned, never
  thrown.
- **Ask first:** any dependency beyond those above; another database engine; a logging library; a
  second owner or any role (D27).
- **Never:** a token or password in a log entry, response or the database (only the hash); a stored
  address; a way to skip a first-run step; a claim after first run; `includeSubDomains`.

## Docs this module changes when built

- **`docs/SPEC.md`:** the status line and row 3 (built); the tech-stack table (Turso, Drizzle, the
  fonts and the icons); the `db:generate`, `preview` and `smoke` command rows; the testing section;
  "Open decisions": the `setup` line goes; ground-floor choices 1 and 3 close.
- **`docs/decisions.md`:** D15 moves to Decided with the validated pair, and D5's "(validation open
  in D15)" points to it; D14's logging half moves to Decided in D11 as the app's own logger and
  why, and D14 keeps only the job half. D16 stays open: the README's backup rule isn't a tested
  restore procedure.
- **README:** the variables above, the database and its backup, `ORIGIN` and the proxy fix, first
  run (the token in the console), logs, and stopping with the server's limits.
- **AGENTS.md:** the status and the structure tree.

## Success criteria

1. The tests above pass, with `check`, `lint`, `build`, `smoke` and prek, and CI's `checks`,
   `smoke` and `ci-ok` pass.
2. A fresh built server prints a token, sends every page to `/setup`, and is claimed once over
   plain HTTP; then the placeholder `/` serves as before, with the headers and CSP.
3. D15's validation has passed in otpravkarr, with its evidence in the build PR's body.
4. The docs listed above say what was built.

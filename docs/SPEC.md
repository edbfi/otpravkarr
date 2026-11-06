# Spec: otpravkarr

**Status:** the ground floor (skeleton) is specified here, approved by the orchestrator
(2026-10-18) and built. The capability map below is approved; module 1, `secrets`, is built
([SPEC-secrets.md](SPEC-secrets.md)).

## Objective

otpravkarr lets the accepted Plex friends of a server owner sign in with Plex and get their own
scoped IPTV account on the owner's Dispatcharr, through a subscriber portal and an owner console
([PRODUCT.md](../PRODUCT.md)).

**This spec covers only the ground floor:** an empty, production-shaped SvelteKit app that builds,
type-checks, tests, lints and serves on Bun, styled from the design tokens, with the edbfi Bun web
CI around it. It has no database, authentication, Plex, Dispatcharr or product features. Its job is
to make the first module spec cheap to build: every later PR adds behaviour, not plumbing.

## Capability map

**Status:** approved by the owner (2026-10-23), with the shared opening widened on 2026-10-24
(D27; shared rows aligned 2026-10-30). Module ids never change. Each module gets its own
`docs/SPEC-<id>.md`, which the owner approves just before it is built.
Sources: [PRODUCT.md](../PRODUCT.md), [decisions.md](decisions.md), the
[Dispatcharr research](research/dispatcharr.md), the [Plex research](research/plex.md), the
[surface briefs](../.impeccable/surfaces/) and the [Module notes](#module-notes) below.

**Every module keeps to [Code structure](../AGENTS.md#code-structure).** Its spec names the files it
adds in that layout, and review checks them. In short:
- The same role folders as every edbfi app. A folder exists only once it holds a real file.
- One purpose per file. No `utils`, `helpers`, `common` or `misc` files.
- Group by domain under the role folders. The folder says where; the file name says what.
- Imports only go downwards. Routes, hooks and jobs stay thin and call services.
- Tests sit next to their source.

**Every module writes its text in English and Danish** through `i18n` (D28): no user-facing text in
components or services, and dates and numbers formatted for the viewer's locale.

| # | Module id | Responsibility | Depends on | Surfaces |
|---|---|---|---|---|
| 1 | `secrets` | **Built.** Encrypts stored secrets (Plex token, Dispatcharr key, subscriber XC passwords, two-factor secrets, the OIDC client secret) before they reach the database (D27, D31), and the secret wrapper that shows only a redaction marker and opens at one named call | — | — |
| 2 | `i18n` | The translation groundwork (D28) with Paraglide JS (D29): message files in English and Danish, choosing each request's language, the language switcher, formatting dates and numbers for the viewer's locale, and a check that every message exists in both languages | — | the language switcher in each shell |
| 3 | `setup` | Startup checks, database and migrations, settings, structured logging with redaction, security headers and CSP (ground-floor choice 3), the setup gate, the bootstrap token, printed to the console and never through the stored logs, and claiming the instance for its one owner, with `sign-in`'s address hint on the claim page. otpravkarr adds the audit trail: its table and the one service every later change writes through | `secrets`, `i18n` | first-run setup (no brief yet) |
| 4 | `sign-in` | Owner sign-in with username and password, signing the new owner in at the claim (D27), sessions, sign-out (POST only), rate limits, the cross-origin check (it asks the browser, stores no address and takes `ORIGIN` as an optional override) with its address hint on the claim and owner sign-in pages, app-named cookies that work over plain HTTP at home and behind an HTTPS proxy, password change, error pages, recovery (D27), and the admin shell | `setup` | owner sign-in (no brief yet); the admin shell; the password section of the owner's account settings |
| 5 | `two-factor` | Optional but strongly recommended (D27): authenticator codes, backup codes and the challenge after every way the owner signs in (except the optional OIDC skip, D27), with replay protection and a limit on failed attempts. Recovery turns it off. Adds the offer to first-run setup, right after the owner account is created and before any connection step, and the reminder in the admin shell while it is off | `sign-in` | the two-factor offer in first-run setup; the owner's account settings (no brief yet); the reminder in the admin shell |
| 6 | `plex-connection` | Plex provider (D12, D18), SSRF-safe outbound HTTP (D8), and connecting, testing and saving the Plex server | `sign-in` | `/admin/settings/connections` (Plex form) |
| 7 | `dispatcharr-connection` | Dispatcharr provider with its service user (D25), version gate and contract tests (D26), and connecting, testing and saving the internal and public URLs and the key | `sign-in` | `/admin/settings/connections` (Dispatcharr form) |
| 8 | `health` | Plex, Dispatcharr and database checks on a timer, public `/healthz` (`ok`, `degraded`, `unhealthy`), the exposure item (D19) and the version warning (D26) | `plex-connection`, `dispatcharr-connection` | `/admin` (health tiles); `/healthz` |
| 9 | `lineup` | Lineup policies, core, fixed and approved groups, bundles, quarantine names, `hidden_from_output` (D24), content defaults (D22), and the offered and effective groups worked out from each person's choices | `dispatcharr-connection` | `/admin/settings/lineup` |
| 10 | `scoping` | Owned group profiles and the empty profile (`start_empty`, D23), the single enforcement path, event groups, and finding unsafe users (D23) | `dispatcharr-connection` | — |
| 11 | `accounts` | Subscriber records and their Streamer users (D21): create, disable by clearing `xc_password`, enable, remove permanently, rotate credentials, apply content flags (D22), and the ownership marker (D23) | `scoping` | — |
| 12 | `plex-sign-in` | Sign in with Plex. For friends: the accepted-friend check, the revoked view, the picker for new friends and provisioning on first sign-in. For the owner: linking their Plex account in the admin settings, after which Plex signs them in as the owner, through two-factor when it is on (D27) | `two-factor`, `plex-connection`, `lineup`, `accounts` | `/`; the owner's account settings (no brief yet) |
| 13 | `credentials` | The subscriber's XC URLs only (D19), reveal and copy, QR code on request, M3U snapshot, refreshing credentials, and the guide for free and open-source players | `plex-sign-in` | `/portal`, `/portal/setup` |
| 14 | `channel-choices` | Subscribers pick bundles or groups within policy, or see a locked view | `plex-sign-in`, `lineup` | `/portal/channels` |
| 15 | `subscriber-admin` | Users table with filters and drift, details, disable, enable, re-provision, remove, rotate, changing groups and the lock, per-person content flags, and "Subscribe myself", keyed on the Plex account behind the server token, so it needs no owner Plex link. How the owner opens that subscriber view is settled in this module's spec | `accounts`, `lineup`, `plex-connection` | `/admin/users` |
| 16 | `sync` | The reconcile job: friend sync, adopting or removing managed users through the marker (D23), quarantine refresh, the subscription sync, plugin scope checks, the `m3u_refresh` webhook (D24), the interval setting and running it by hand | `accounts`, `lineup`, `plex-connection` | `/admin` (sync card); `/admin/settings/connections` (sync interval) |
| 17 | `audit-log` | The audit log page with filters, and the retention job (the writing comes with `setup`) | `sign-in` | audit log (no brief yet) |
| 18 | `oidc-sign-in` | Connecting one OpenID Connect provider (Authentik, Authelia, Pocket ID, Tinyauth and others) by its issuer, client id and secret, and linking the owner's account to it, after which it signs them in as the owner, and offering to skip `two-factor` when the provider's `amr` claim reports its own second factor (D27) | `two-factor` | the owner's account settings (no brief yet); its button on owner sign-in |
| 19 | `plugin-advisories` | Read-only plugin cards: ECM scope, plugins that target owned profiles, and auto-sync groups without a scope (D24) | `scoping`, `lineup` | plugins (no brief yet) |
| 20 | `overview` | The owner dashboard: health, user counts, sync, recent activity, available friends | `health`, `accounts`, `sync`, `audit-log` | `/admin` |

Build order: `secrets` → `i18n` → `setup` → `sign-in` → `two-factor` → `plex-connection`,
`dispatcharr-connection` → `health`, `lineup`, `scoping` → `accounts` → `plex-sign-in` →
`credentials`, `channel-choices`, `subscriber-admin`, `sync` → `audit-log`, `oidc-sign-in`,
`plugin-advisories` → `overview`. A comma means either order works. The first five are the
opening every edbfi app shares (D27). `credentials` comes first in its group because it's the first
time a friend gets something they can use.

### Where modules live

Paths are under `src/lib/server/`, except those starting with `routes/` (under `src/`) or `lib/`
(under `src/`), and `hooks.server.ts` (`src/hooks.server.ts`). They follow the
[Code structure](../AGENTS.md#code-structure) layout:

| Module | Main homes |
|---|---|
| `secrets` | `security/secrets/` (key checks, keyring, cipher, `Secret`), `config/secret-key.ts`, `src/env.ts` and the `init` hook in `hooks.server.ts` |
| `i18n` | `messages/en.json` and `messages/da.json`, `project.inlang/` (Paraglide's settings), `lib/shared/i18n/` (formatting); `paraglideMiddleware` in `hooks.server.ts` |
| `setup` | `db/` (client, migrations, settings, owner and audit schema), `config/`, `logging/`, `services/setup/`, `services/audit/record.ts`, `security/bootstrap-token.ts`, `security/headers.ts`; `routes/setup/`, and the setup gate and the headers in `hooks.server.ts` |
| `sign-in` | `services/sign-in/` (sessions and their storage, recovery), `db/` session schema, `security/` (session-token and password hashing, rate limiting, the cross-origin check), `vite.config.ts` (SvelteKit's own form check off); the sign-in and the address hint at the claim in `routes/setup/`, `routes/(admin)/` layout, `lib/components/layout/` |
| `two-factor` | `services/two-factor/`, the owner schema's two-factor fields in `db/`; the offer in `routes/setup/`, the challenge page beside the sign-in page, its section of the owner's account settings, and the reminder in `lib/components/layout/` |
| `plex-connection` | `providers/plex/`, `http/`, `services/connections/plex.ts`; `routes/(admin)/admin/settings/connections/` |
| `dispatcharr-connection` | `providers/dispatcharr/`, `services/connections/dispatcharr.ts`; same route |
| `health` | `services/health/` (replaces `services/health.ts`), `jobs/health.ts` |
| `lineup` | `services/lineup/`, `db/` lineup schema; `routes/(admin)/admin/settings/lineup/` |
| `scoping` | `services/scoping/`, `db/` group-profile schema |
| `accounts` | `services/accounts/`, `db/` subscriber schema |
| `plex-sign-in` | `services/plex-sign-in/`; `routes/(public)/` and the Plex return route |
| `credentials` | `services/credentials/`; `routes/(app)/portal/`, `routes/(app)/portal/setup/` |
| `channel-choices` | `routes/(app)/portal/channels/` (uses `lineup` and `accounts`) |
| `subscriber-admin` | `routes/(admin)/admin/users/` (uses `accounts`, `lineup` and `connections/plex.ts`) |
| `sync` | `services/sync/`, `jobs/sync.ts`; the webhook under `routes/api/` |
| `audit-log` | `services/audit/search.ts`, `jobs/audit-retention.ts`; `routes/(admin)/admin/audit/` |
| `oidc-sign-in` | `services/sign-in/oidc.ts`, the provider settings and the owner's link in `db/`; its callback route beside the sign-in page |
| `plugin-advisories` | `services/plugins/`; `routes/(admin)/admin/plugins/` |
| `overview` | `routes/(admin)/admin/` |

### Open decisions each module closes

- `i18n`: the validation that D29 lists (pinned versions, the adapter-bun build, a Weblate round
  trip).
- `setup`: D15 (Drizzle and Turso pair) and the logging library half of D14.
- `setup`: how responses sent before `handle` (such as Bun's `413` for a body over the limit) get
  the security headers.
- `setup`: whether the content security policy refuses inline style attributes, which Ark UI and
  Svelte write.
- `sign-in`: how long an owner session lasts.
- `sign-in`: the password rules: the minimum length, whether a list of common passwords is
  refused, and how repeated failed sign-ins are slowed beyond the rate limits (backoff, or a lockout
  where the app's approved docs allow one).
- `two-factor`: its limit on failed attempts (how many, and over what time).
- The first module with a background job closes the job half of D14: `sign-in` if its session
  cleanup is a job, otherwise `health`.
- `plex-connection`: D18. `health`: D20 (the exposure item belongs to the Dispatcharr health check,
  D19).
- `scoping`: whether the event-group suffixes stay fixed or the owner sets them.
- D13: no module here needs a generated API client yet. D17 stays open as an accepted limit.

### Left out on purpose

- Self-managed and staff modes, and the Change Profile action, which only made sense for them
  (D21).
- The setup "Defaults" step (nothing used it, and the default mode went with D21).
- The admin friends and detailed health APIs, and the unlinked owner "where would you like to go?"
  page (no consumer).
- Email or other notifications, to the owner or to subscribers, and importing friends in bulk: a
  friend gets an account the first time they sign in.
- Environment locks on settings, as obzorarr has them: the Plex and Dispatcharr connections are set
  in the app, and the shared-groundwork map lists the locks for obzorarr and zondarr only.
- Any public API beyond `/healthz` (row 8) and Dispatcharr's `m3u_refresh` webhook (D24): everything
  but the public pages (the landing page, sign-in and the claim) needs an owner or subscriber
  session.
- Any role beyond the one owner (owner decision).
- Signing in through a reverse proxy's headers (D27): `oidc-sign-in` covers the same identity
  providers.
- Connecting Weblate (D28): later work, outside this map. The message files are ready for it.
- Recognising the owner automatically as the Plex account behind the server token, as the legacy
  app did. The owner links their Plex account themselves, if they want to (D27, owner decision).
  The self-subscription still uses that account as its identity (`subscriber-admin`); it just
  doesn't sign anyone in.
- **The container image's first start** (deferred: a note, not a design). It is specified and
  built only when Otpravkarr is first tested through its image (`edbfi/otpravkarr-docker`); building
  images through GitHub, including the nightly build of `main`, is a later goal. The intent, with
  the app's code unchanged: when `OTPRAVKARR_SECRET_KEY` and `OTPRAVKARR_SECRET_KEY_FILE` are both
  unset or empty, the image's setup script points `OTPRAVKARR_SECRET_KEY_FILE` at
  `/config/secret.key` whenever that file exists. It creates the file first (a random 32-byte key
  in standard base64, written atomically, mode 0600, owned by the app's user) only when
  `/config/data` is empty and nothing shows an older install (such as the previous app's secret or
  database variables; the image's own defaults don't count, and the exact checks are decided with
  the image); otherwise it creates nothing, and the app stops with its own key error. An
  operator's own key or secret file always wins, and the README tells the operator to keep a copy
  of the key file. Nothing the v0.1.x images left is ever used as a key; how such an install
  upgrades is decided with the image.

### Surfaces with no brief yet

First-run setup, owner sign-in, the owner's account settings, `/admin/plugins` and `/admin/audit`
are needed (the last two are in PRODUCT.md's admin shell) but have no brief. Each gets one before
its module is specced, starting from its module's [Module notes](#module-notes).

### Module notes

What a capability-map row commits to in more detail than a clause fits, carried over from the legacy
app and adapted to the decisions. It is behaviour to keep unless the module's approved spec or a
decision changes it. Layout, placement, visuals and exact wording are not behaviour: where a note
describes them, DESIGN.md and the surface's brief win, and for a surface with no brief yet the note
is only a starting point for that brief. Each block moves into its module's `SPEC-<id>.md` when that
module is specced. Rate limits are listed once, under `sign-in`. `i18n`, `setup` and `sign-in` are
shared with the other edbfi apps (D27), with obzorarr as their reference: a bullet or clause marked
"(otpravkarr)" is this app's own, and the rest is the shared wording; a "(otpravkarr)" mark inside a
bullet covers the rest of that bullet, and "(otpravkarr: …)" only its own parentheses. Decision
numbers in these blocks are otpravkarr's.

#### i18n

- A number in a message that states how the app behaves (a limit, a duration, a count) is passed
  in as a parameter from the constant the logic uses, never written into the text, so the copy
  can't drift from the behaviour.

#### setup

- **The setup gate.** Until first run is complete, every page except static assets, the claim,
  sign-in and first run's own helpers sends the browser to the current first-run step. The server
  keeps one current-step pointer: the browser can't skip ahead, each step's action checks that it is
  the current step, and a step that offers Previous only moves the pointer back. Only the last
  step's action completes first run. (otpravkarr) `/healthz` is exempt too, and going back keeps
  what the owner typed. After the claim come `two-factor`'s offer, then Plex (`plex-connection`) and
  Dispatcharr (`dispatcharr-connection`). Completing first run seeds `health` and lands on `/admin`;
  afterwards the setup routes answer "not found".
- **The bootstrap token** (D27) is 12 random lowercase letters and digits, shown as
  `xxxx-xxxx-xxxx`, held only in memory (never logged or stored) and compared in constant time. It
  is printed with the setup URL and is valid for 15 minutes, after which a new one is printed. Claim
  attempts are rate-limited (`sign-in`). (otpravkarr) A token in the URL is ignored: it must be
  typed.
- **The claim** is a POST, cross-origin-checked like any other (`sign-in`), and it stores no
  address. It needs a valid bootstrap token and the browser's address (`sign-in`). Using up the
  token and creating the owner are one atomic step, and the owner session it starts follows
  `sign-in`'s cookies.
- **The owner account** (otpravkarr): the claim asks for a username of 3 to 32 letters, digits,
  underscores or dashes, and the password twice; the password rules are `sign-in`'s open decision.
  There is never a second owner (D27).
- **The audit trail** (otpravkarr): one service writes every entry, and entries are never edited,
  only removed by retention (`audit-log`). An entry has a time, an action, and where known the
  actor (the owner, or a subscriber's Plex username for their own actions; none for the system) and
  the client address, plus optional structured detail. Everything that changes state is audited,
  first run included: each step as a configuration change with secret values left out, then "setup
  completed". A configuration entry is written only when something actually changed. An entry
  about a subscriber carries their Plex username and their Dispatcharr username, the latter as
  Dispatcharr reported it, never a stale local copy, so a search on either finds it.
- **Settings** (otpravkarr) hold one value per key: a write replaces it, and clearing writes an
  empty value. Secrets among them are encrypted (`secrets`). A secret's field is blank again after
  saving; other fields keep their values.
- **Settings URLs:** upstream base URLs may not hold credentials, a query or a fragment.
  (otpravkarr) Only `http` and `https` are accepted, and a URL is reduced to its origin. The Plex
  server URL and Dispatcharr's internal URL carry secrets, so they must be HTTPS, except that plain
  HTTP is allowed for loopback, private and local hosts (such as `http://dispatcharr:9191` on a
  Docker network, `http://plex.internal:32400`, or an mDNS `.local` or VPN name) once the owner opts
  in for that URL. A host counts as loopback, private or local by the address it resolves to when
  the app connects (D8), never by its name: loopback, the private LAN ranges, link-local, IPv6
  unique-local and the shared range VPNs such as Tailscale use (`100.64.0.0/10`). A local-looking
  name that resolves to a public address gets no plain HTTP. Dispatcharr's public URL goes into the
  URLs subscribers get, so it must be HTTPS, with no exception (`credentials`): saving a plain-HTTP
  one is refused with a message that says why.
- **Logging.** Four levels; debug entries are dropped unless debug logging is on. Each entry has a
  level, a message, a source, structured metadata and a millisecond timestamp, and goes to standard
  output (D11). Redaction runs before an entry is written anywhere: credentials in URLs, token-like
  query parameters, token, authorisation and cookie fields in payloads and headers, and, at any
  depth, any metadata key that looks like a token, secret, password, cookie, session or key.
  (otpravkarr) One entry per request (method, the path without its query string, status, duration,
  client address), plus job, health and unhandled-error entries (with a request id, the error's
  class, message and stack). Query strings and request bodies are never logged, and upstream
  response bodies never reach the user. The only secrets printed on purpose are the bootstrap and
  recovery tokens, on the console (D27). There are no metrics, telemetry or outbound reporting.
- **Security headers,** on every response, early returns (otpravkarr: and the setup gate's redirect)
  included: framing denied, no MIME sniffing, a referrer policy of `same-origin` or
  `strict-origin-when-cross-origin`, never `no-referrer` (which makes browsers send `Origin: null`
  on the app's own form posts), a permissions policy denying camera, microphone and geolocation, and
  a nonce-based content security policy: scripts from the app only; images from the app and inline
  data (otpravkarr: and Plex's hosts, for avatars); fonts from the app (DESIGN.md bundles them);
  connections to the app only (otpravkarr: and Plex); no framing; the app only as base and form
  target. (otpravkarr: these are ground-floor choice 3; whether inline style attributes are refused
  is for `setup`'s spec, since Ark UI and Svelte write some.) Strict transport security (otpravkarr:
  whether it is sent, and for how long, is for `setup`'s spec) goes only over HTTPS (known when
  `ORIGIN` is `https`, or when the browser sent `Sec-Fetch-Site` to a host that isn't loopback,
  since browsers send it only to HTTPS and loopback addresses).
- **Startup and shutdown.** Startup runs once, before any request is served: migrations (D5), then
  each module's startup work (otpravkarr: restoring the learned quarantine names, `lineup`, and one
  health probe, `health`), then starting the jobs (otpravkarr: sync at its saved interval, health,
  session cleanup and audit retention); a job that fails to start is logged, not fatal. Shutdown
  stops the jobs, flushes the logs and drains open requests for a bounded time, then exits even if
  an upstream call is still outstanding. A second signal exits at once, and a hang-up counts as a
  stop. The environment sets the drain time (default 30 seconds, kept below the container's stop
  timeout). (otpravkarr) It also sets the database location (by default a data directory created on
  first start), the idle timeout (default 10 seconds; 0 turns it off) and the request body limit
  (default about half a megabyte; unit suffixes or unlimited). In production, an explicitly set
  database path that doesn't exist stops startup instead of creating an empty database, so a missing
  volume can't pass for a fresh install. Pending migrations apply in order, each once, as one
  all-or-nothing batch, and only go forward: a backup is a coherent snapshot of the database file
  with the master key (D16, D31), noted with the app version that wrote it, and the app is never
  downgraded across a migration.
- **Trust:** anyone who can read the server console can claim a fresh install.

#### sign-in

- **Request order** (startup has already finished in SvelteKit's `init` hook): the cross-origin
  check, rate limits, sign-in, the setup gate, then the owner check. Security headers go on every
  response, an early return from any stage included.
- **Owner-only pages** send someone who isn't signed in to owner sign-in, with a return path that
  keeps only the path, never the query string; where the app has member sessions, a signed-in member
  goes to their dashboard. An owner-only form action answers "forbidden"; a member's form action
  without a session answers "unauthenticated" rather than failing. (otpravkarr) Owner and subscriber
  sessions are separate kinds: each is refused where only the other is allowed, and an owner JSON
  endpoint answers "unauthenticated" without a session and "forbidden" with a subscriber's. A bad
  session cookie is cleared, and a subscriber page without a subscriber session sends the browser to
  `/`. A signed-in owner who opens owner sign-in goes to `/admin`, and from `/` too until
  `subscriber-admin`'s spec settles how the owner opens their subscriber view.
- **Return paths** are same-origin paths only: one leading slash, no backslashes or control
  characters, at most 2,048 characters. Only the path is kept.
- **Rate limits** apply per client address. The client address comes from the connection, or from a
  header and a proxy depth (default 1) set in the environment. Responses carry `Retry-After` and
  remaining and reset headers, and come as a form error, a JSON error or a branded page, whichever
  the caller expects. (otpravkarr) Kept in the process (one process, D4, D17): the claim 5 per 15
  minutes, owner sign-in 5 per 5 minutes, starting Plex sign-in 20 per 15 minutes, and failed
  two-factor codes (the numbers are an open decision for `two-factor`). Owner sign-in and two-factor
  count only failed attempts, and owner sign-in shows when the next try is allowed; the claim and
  starting Plex sign-in count every attempt. The client-address header is set only when every
  request passes through a trusted proxy, and the address is taken that many hops from the right.
- **SvelteKit's own form check is off:** `sveltekit({ csrf: { trustedOrigins: ['*'] } })` in
  `vite.config.ts` (SvelteKit 3 takes its options in the `sveltekit()` call, with no `kit:`
  wrapper). Remote functions stay off. A config test asserts both, so SvelteKit's only remaining
  check before `handle` is the remote-function one, which nothing uses. The cross-origin check
  replaces SvelteKit's form check.
- **The cross-origin check** asks the browser, so the app doesn't need to know its own address and
  stores none. It runs first in `handle` for every method except GET, HEAD and OPTIONS, and for
  every content type (form, JSON, multipart, `text/plain`, empty). Internal `event.fetch`
  subrequests (`event.isSubRequest`) skip it.
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
    on an explicit list of machine routes (otpravkarr: Dispatcharr's `m3u_refresh` webhook, with its
    shared-secret header, D24): the API-key endpoints and other machine routes the app's approved
    docs already name, each with the credentials those docs require. The session cookie is never
    honoured on it: such a request that carries only a session cookie gets a 403.
  - A refusal is a 403 with the app's own "Access denied" page, or a JSON error for JSON callers,
    with the security headers and in the viewer's language.
- **The browser's address** is `ORIGIN` when it is set, and otherwise the validated `Origin` of the
  POST that passed the cross-origin check. It decides the cookies' `Secure` flag, the OIDC
  `redirect_uri` and, where the app has Plex sign-in, Plex's forward URL. Every POST that sets or
  deletes a cookie needs it, such as the claim, sign-in, the two-factor challenge, recovery,
  sign-out and the start of OIDC sign-in (and of Plex sign-in, where the app has it): when a
  browser stripped `Origin`, they get a 403 that says so (the "Access denied" page, or a JSON
  error for JSON callers). OIDC sign-in (and Plex sign-in, where the app has it) keeps the address
  in the flow's state. The OIDC callback address is saved when the owner configures OIDC, and must
  match. Links shown on GET pages for copying, such as the OIDC callback to register, are built in
  the browser from the address the user is on, or from `ORIGIN` when it is set. App code never uses
  `event.url.origin` or `event.url.protocol` for security, cookies or rendered URLs, which a test
  that searches the code enforces, and redirects stay relative. (otpravkarr) Its Plex parts cover
  the subscribers' Plex sign-in as well as the owner's.
- **The address hint:** when `ORIGIN` is set and doesn't match the address the browser is on, or
  when `ORIGIN` is unset and that address's host and port don't match the `Host` header, the claim
  and owner sign-in pages suggest setting `ORIGIN=<that address>` (or removing a wrong `ORIGIN`) or
  adding the proxy line `proxy_set_header Host $http_host`, so someone without a session can
  recover. (otpravkarr) otpravkarr has no address-check module, so `sign-in` carries the hint
  itself, on the owner sign-in page and on `setup`'s claim page, not on the subscribers' landing
  page.
- **`ORIGIN`** is optional and never required. It is plain `ORIGIN`, not an app-prefixed name (an
  app prefix would mean setting adapter-bun's `envPrefix`, which would then reject the master key's
  variable). When set, it must be a bare `http` or `https` origin (a trailing `/` is fine; no path,
  query, fragment or credentials), compared as a parsed origin, or startup stops with an error that
  doesn't echo the value. adapter-bun 1.0.0 ignores `ORIGIN`; from 1.0.1 a set `ORIGIN` also
  corrects SvelteKit's `event.url`, and an empty `ORIGIN=""` throws with the value in the message,
  so the container image's entrypoint unsets an empty `ORIGIN` and its templates leave it out (the
  image's work, not this repo's).
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
- **Tests:** the cross-origin check is one pure module, unit-tested against a matrix of headers and
  copied to each app as D27 shares the opening modules. One Playwright test against the built server
  (`bun ./build`) checks that a cross-site form POST is refused and that a same-origin POST carrying
  no `Sec-Fetch-*` headers passes, both on `localhost` and on a plain-HTTP host name that isn't
  loopback (such as Chromium's `--host-resolver-rules="MAP app.test 127.0.0.1"`).
- **Forwarded headers:** a forwarded protocol must be `http` or `https`, and a forwarded host with
  whitespace, control characters or URL-structural characters is rejected; forwarded headers never
  set the browser's address or change the strict-transport decision. (otpravkarr) otpravkarr reads
  no forwarded protocol or host; it reads only the rate limits' client-address header.
- **Cookies:** session cookies are named after the app (otpravkarr: the owner's and the
  subscribers' session cookies alike, such as `otpravkarr_session`), because cookies ignore ports
  and apps on one address would otherwise sign each other out. They are host-only, `HttpOnly` and
  `SameSite=Lax`. Every cookie is `Secure` exactly when the browser's address is `https`, so a
  plain-HTTP install at home still works. Every cookie write and deletion sets `secure` explicitly
  (SvelteKit's default is `Secure` on every host but `localhost`), and a deletion whose scheme isn't
  known uses `secure: false`, which works over HTTP and HTTPS.
- **A wrong address never locks the owner out.** No stored address can stop password sign-in: a
  wrong `ORIGIN` is fixed or removed, then the app restarts. The OIDC callback address is stored,
  so OIDC may need registering again after a move, but password sign-in always remains (D27).
- **Owner sign-in** (otpravkarr): the password is stored under a modern memory-hard, salted hash. An
  unknown username and a wrong password get the same message and take the same time (a password hash
  is checked either way). A successful sign-in first deletes the session the browser's cookie named,
  then starts a new one, and is audited; failed attempts aren't audited (the rate limit covers
  them).
- **Sessions** (otpravkarr): a random opaque token in the cookie, stored hashed (D27), with its kind
  (owner or subscriber), whom it belongs to and an absolute expiry. A person may have several
  sessions at once. Every sign-in, owner or subscriber, replaces the session the browser's cookie
  named. A cleanup job removes expired sessions every 30 minutes.
- **Errors:** an unexpected error is logged and the user sees "Something went wrong. Try again.";
  expected errors pass through; network failures map to fixed phrases; stack traces never reach the
  browser. Error pages are titled "Page not found", "Access denied", "Too many requests" or
  "Something went wrong", each with a one-line description and Go back and Home actions; a
  not-found page doesn't show the status number.
- **Sign-out** is POST only, behind a confirmation; a GET only redirects, so an image tag or a
  prefetch can't sign anyone out. (otpravkarr) It deletes the session, is audited for the owner, and
  takes the owner to owner sign-in and a subscriber to `/`.
- **The admin shell** (otpravkarr): PRODUCT.md's sidebar, the signed-in owner and sign-out behind a
  confirmation; on phones the sidebar is a drawer that closes after navigating.

#### plex-connection

- **Pull only:** nothing is written to Plex, and the friends list is fetched fresh for every
  subscriber sign-in and every sync, never from a cache (the dashboard's cache is `overview`'s).
- **Connecting,** in first run and in the settings: the owner pastes the server URL and token, or
  gets the token through Plex's PIN sign-in in a popup, which signs nobody in (D27). After the
  popup, the account's servers are discovered and each server's connections ranked: remote HTTPS,
  then local HTTPS, then local HTTP, with loopback and container-internal addresses lower and Plex's
  relay last. The owner picks one, and picking a local HTTP connection asks for that URL's
  plain-HTTP opt-in (`setup`); when discovery fails, typing a URL is offered.
- **Checking** reaches plex.tv with the token, then the server, and requires a friendly name, a
  machine id, and that the token's account has access to that server. Transient failures are retried
  with backoff while the seconds elapsed are shown; a bad token, a bad request or "not found" isn't
  retried. On success the server's name, machine id and version are shown, and the machine id stored
  is the one the server reports.
- **The settings form:** the URL, whether a token is stored with a blank field to replace it, and
  the machine id, read-only. Saving checks again and says whether it saved a change or found nothing
  to change. A test or a save reuses the stored token only while the URL still matches the stored
  one: a changed URL needs the token typed again, so a saved secret is never sent to a newly typed
  address.
- **Failures:** malformed friend data fails closed; transient connection failures are retried with
  backoff; a portal page that hits a Plex failure shows a controlled error instead of crashing.

#### dispatcharr-connection

- **Connecting,** in first run and in the settings: the internal URL, used for every API call; an
  optional public URL, used only in the URLs subscribers get (`credentials`); and the key (D25). One
  quick test tells "couldn't connect" from "the key is invalid". The settings form shows whether a
  key is stored, with a blank field to replace it, and its help tells the internal address from the
  one players use. A test or a save reuses the stored key only while the internal URL still matches
  the stored one: a changed URL needs the key typed again, so a saved secret is never sent to a
  newly typed address. When the public URL is blank and the internal URL is plain HTTP, saving warns
  that subscribers get no URLs until an HTTPS public URL is set (`credentials`).
- **Two kinds of call:** interactive ones (page loads, connection tests) have a short timeout sized
  to finish inside the server's idle timeout (`setup`) and no retries; background ones (jobs,
  provisioning, showing credentials, health) have a 15-second timeout, one retry for safe reads and
  none for writes. A page whose interactive call runs out shows a degraded view, never a blank
  error.
- **Paging:** a `next` link is rebased onto the configured host, so the key is never sent anywhere
  else, and a failure on any page fails the whole read (no partial results).
- **Validation:** responses are schema-checked and fail closed; a profile's membership that isn't a
  list is an error, never an empty profile. Plugin payloads are read leniently, since their shape
  isn't defined.
- **Errors** are classed as an auth failure, not found, invalid, a server error, a network error or
  an unexpected shape. Writes are never retried, and response bodies never reach the user and are
  redacted in the logs.
- **Writes** are limited to creating, updating (custom properties always merged) and deleting users,
  creating profiles and updating a profile's membership in bulk. otpravkarr never deletes a profile
  and never changes channels, groups or plugins.

#### health

- **State** is kept in memory: it starts pessimistic, is probed once at startup, then every 5
  minutes, and is set to healthy when first run completes.
- **Plex:** healthy, unauthorised, unreachable, or "server changed" (the server reports a machine id
  other than the stored one). plex.tv being down while the server answers still counts as healthy.
- **Dispatcharr:** reachable, and the key valid. A reachable result, a definite "key invalid"
  included, shows at once; "unreachable" shows only after two failed probes in a row, so one blip
  keeps the last good state. Every failed probe is audited.
- **Database:** a write, then reading it back.
- **Overall:** `unhealthy` when the database check fails, `ok` when all three pass, otherwise
  `degraded` (so a fresh instance is `degraded`). `/healthz` returns only that word; the owner's
  tiles show each check and when it ran.

#### lineup

- **Settings:** a default policy (fixed, core plus bundles, or approved selection; core plus bundles
  on a fresh install), the fixed, core and approved group lists, and the bundle catalogue with a
  version number the owner moves forward when bundle contents change. The approved list is never
  seeded: unset or malformed means nothing is approved, never every live group. Saving checks the
  lists against the live groups, and the pickers are disabled, saying why, when no live groups
  outside quarantine load.
- **Bundles** have a permanent id and slug, fixed at creation (enforced in storage; never derived
  from the name), and an editable name, enabled flag and ordered group list.
- **Intent and effect:** each subscriber's intent is an optional policy override, their chosen
  bundles, their chosen approved groups and a lock on choosing. Only the owner (`subscriber-admin`)
  changes it, and the subscriber only their own bundles and groups (`channel-choices`); resolution
  and sync never do, and malformed intent reads as empty. What they get now, their effective groups,
  is stored apart.
- **Requested groups:** fixed gives the fixed list; core plus bundles gives the core list plus the
  groups of every enabled bundle they chose; approved selection gives exactly the approved groups
  they chose.
- **Effective groups** are the requested groups minus any that aren't live in Dispatcharr, aren't
  approved, or are in quarantine, de-duplicated and sorted. Resolution only narrows: a group that
  drops out keeps its intent and comes back when it returns.
- **Offered groups**, what a picker shows, are the live, approved groups outside quarantine. A new
  subscriber starts with everything offered chosen. The per-person lock freezes their choice and
  shows them a read-only view that says the owner manages it.
- **Where it applies:** a new friend's first sign-in (`plex-sign-in`); re-provisioning an Orphaned
  friend from their saved intent, at their next sign-in (`plex-sign-in`), through the owner's
  Re-provision (`subscriber-admin`) or through the portal's Retry (`credentials`);
  `channel-choices`; the owner's group changes (intent saved first, then resolved and enforced); and
  every sync, which works from intent for every active subscriber, the owner's self-subscription
  included, never from the stored effective groups.
- **Quarantine groups** are never offered, never effective and left out of every picker, matched by
  trimmed, case-insensitive name. Every sync reads IPTV Checker's three destination-group settings
  (defaults merged, D24) and replaces the learned names with them, always alongside the plugin's
  three default names. Missing information never shrinks the list: when the plugins can't be read,
  the plugin is absent or disabled, or it gives no usable names, the previous names stay. The names
  are saved (best effort) and loaded at startup, so renamed quarantine groups stay hidden before the
  first sync. Intent pointing at a quarantined group simply has no effect until the group leaves
  quarantine.

#### scoping

- **The model** (research section 5 confirms it): one owned profile per subscribable group, and one
  shared empty profile with no channels. A subscriber's profile list is exactly one profile per
  effective group, of which Dispatcharr shows the union, or the empty profile for none; it is never
  empty. Every profile is created empty (D23), and a Dispatcharr user at admin level is never
  scoped: it is an incident (D23).
- **Ownership:** a profile's name is an owned prefix, the group id and the group's name, with commas
  removed (ECM's scope setting is a comma-separated list), whitespace collapsed and cut to
  Dispatcharr's limit. Ownership is the prefix plus the group id, so renames don't matter, and
  choices are keyed on group and channel ids, never names. otpravkarr never changes a profile it
  didn't create, and deletes none.
- **Group profile records** are global, one per group; a profile serves only one group, and the
  empty profile has its own record.
- **The single enforcement path,** used by provisioning, the owner's edits, the portal and sync:
  1. Check the subscriber has a Dispatcharr user, and that the group ids are positive whole numbers;
     de-duplicate and sort them. Anything else is refused before any network call.
  2. Look up the Dispatcharr user within an interactive deadline (about 8 seconds, inside the
     server's idle timeout) and refuse an admin-level user.
  3. Work from live state, never trusting a stored profile id unchecked. Read every channel and
     bucket it by its effective group (its override group, else its base group; ungrouped channels
     can't be chosen). Read every group and require each requested id to exist. For each group, use
     the stored profile if it still exists and is ours; if it's gone, or the id now belongs to a
     profile that isn't ours, leave that one alone, then adopt or create ours and fix the record.
     Adopting looks for a profile with our prefix and the group id (a reset database or a renamed
     group), gives up rather than risk a duplicate when that lookup fails, and otherwise creates
     one, adopting by exact name on a name clash. Then narrow the membership: send only the
     difference in one bulk update, or nothing when nothing differs, and save the group's full
     channel set as its known-channel snapshot. The empty profile is found or made by exact name,
     and any channel that drifted into it is disabled again.
  4. Write the user's profiles and level in one update whose timeout equals the deadline, so a late
     write is aborted rather than landing after the caller gave up.
  5. Only then save the effective groups locally (this path is their only writer) and a "groups
     changed" audit entry with before and after. A failed audit write is logged and never fails a
     correct scoping, which in provisioning would tear down a correctly scoped user.
- **Event groups** are groups whose names end in " — PPV/Events" or " — Unscheduled Events" (this
  deployment's naming, research section 6; whether they stay fixed is an open decision), detected on
  the group's own name, never on the cut profile name. Event Channel Managarr owns their channels'
  visibility, so their profiles keep what it hid: a channel in the snapshot that is now disabled
  stays disabled, a channel new to the group is enabled, a channel that left is disabled, and an
  empty or missing snapshot enables the whole group. A corrupt snapshot leaves that group unchanged,
  failing before any call to Dispatcharr. Other groups get exact membership.

#### accounts

- **A subscriber record** is unique per Plex account. Dispatcharr's user id is indexed but not
  unique, because drift can duplicate it (rotation refuses a shared one). It holds the Plex identity
  (account id, the secondary id, username, email, avatar URL; refreshed by sync), the Dispatcharr
  link (user id, username, the encrypted XC password and the effective groups), the rules and state
  (active, the owner flag for the self-subscription, the lock, the policy override, chosen bundles
  and approved groups, content flags), and when it was created, updated, last synced and last used.
- **States:** Active (active, with a Dispatcharr user), Orphaned (active, but the Dispatcharr user
  is gone or was never made) and Inactive (disabled by the owner, by sync when the friendship ended,
  or after a failed scoping). Only an active record becomes Orphaned: an inactive record whose
  Dispatcharr user goes stays Inactive, so missing upstream infrastructure never undoes the owner's
  revocation. An Orphaned friend's next sign-in provisions them again, so deleting a friend's user
  directly in Dispatcharr doesn't revoke them. The lasting revocation is disabling the friend in
  otpravkarr or ending the Plex friendship. Removing isn't one: it deletes their Dispatcharr user
  and record, and a friend who is still an accepted Plex friend can sign in again and come back.
- **Provisioning** is idempotent by Plex account id and answers provisioned, already exists,
  reactivated or failed, without throwing for expected failures. It applies the groups it is given
  and doesn't consult policy, so a caller that wants them to survive the next sync saves matching
  intent too.
  - **An active record with a Dispatcharr user:** already exists; Dispatcharr isn't contacted.
  - **An inactive record with a Dispatcharr user:** confirm the user still exists (if it's gone,
    clear the link and create one as below), put the stored XC password back (custom properties
    merged) so bookmarked URLs work again, and only then mark it active and audit "provisioned
    (reactivated)". Then enforce its groups (`scoping`); if that fails, disable it again, audit it
    and report the failure.
  - **Otherwise, create** (an Orphaned record included, which keeps its row): the username is the
    Plex username cut down to lowercase ASCII letters and digits (a fixed fallback if nothing is
    left), taking the first free one of it and numbered variants, checked against local records
    (case-insensitively) and Dispatcharr's users. A failed Dispatcharr lookup is logged and checked
    locally only; after very many clashes a time-based suffix is used. The XC password is 24 random
    letters and digits from a secure source, encrypted before anything reaches Dispatcharr, so a
    failed encryption can't leave an orphan. Then create the Dispatcharr user (D21, D22, D23), save
    the record (updating an existing one, or inserting), audit "provisioned" with the actor and
    client address, and enforce the groups: a new user's empty profile list means every channel, so
    this step is mandatory, and its failure disables the user and audits that. A local write that
    fails after Dispatcharr created the user is reported, and sync finds the user by its marker
    (D23).
- **Disable, enable and remove** follow D23. Enabling puts the stored XC password back and applies
  the saved policy, and provisions afresh when the Dispatcharr user is gone. Re-provisioning an
  Orphaned record creates its Dispatcharr user as above, with the groups resolved from the friend's
  saved choices (their intent, `lineup`). Removing deletes the Dispatcharr user, then the record and
  the person's sessions in one transaction, audited; the person can sign in again later and is
  provisioned afresh.
- **Rotating credentials** needs an active subscriber with a Dispatcharr user whose id no other
  record shares. The new password is encrypted first; then the Dispatcharr user is looked up and
  its XC password set (custom properties merged) within the interactive deadline, and the local
  write succeeds only if the record still has the same id and Dispatcharr id. It is audited with the
  Dispatcharr username as Dispatcharr reported it. "Not found" clears the stale link; a local write
  that fails after Dispatcharr changed reports a possible inconsistency. The owner never sees the
  new password; the subscriber sees it in the portal, and can rotate their own ("refresh
  credentials") under the same rules, audited as themselves.

#### plex-sign-in

- **Starting** asks Plex for a PIN, keeps the pending sign-in in memory for 10 minutes under a
  random id that a short-lived cookie holds, and redirects only to Plex's own sign-in page, with the
  forward URL built from the browser's address (`sign-in`). Transient failures are retried a few
  times with backoff; when that runs out, the message says Plex can't be reached. A restart loses
  pending sign-ins (one process, D4).
- **Returning** uses the cookie once and deletes it, completes the PIN (polling Plex for the
  token), reads the identity (account id, the secondary id, username, email, avatar) and removes the
  pending entry, so it can't be replayed. The friend's Plex token is used only here and never
  stored.
- **Who gets in:** an owner who linked their Plex account signs in as the owner (D27). Anyone else
  must be in the owner's friends list, fetched fresh, as an accepted friend; otherwise they're told
  their Plex account has no access to this server. Someone whose record is inactive is told their
  access was revoked.
- **The new friend's picker** comes before any credentials only when their policy is approved
  selection and at least one group is offered. The verified identity crosses that step in a sealed
  cookie (encrypted, tamper-evident, 10 minutes) that holds no Plex token. Reloading keeps the page
  and an error keeps the choice; choosing nothing warns that the player will show no channels. On
  confirm the server checks the friendship again and every chosen group against the offered groups
  it works out itself (failing closed), then provisions. Returning friends, the owner and every
  other case skip the picker, so nobody is stranded.
- **Provisioning:** a new friend is provisioned with the chosen groups and matching intent. A
  returning friend, an Orphaned one included, is provisioned from their saved intent (`lineup`),
  without overwriting their saved choices or the owner's lock.
- **The session** follows provisioning: a subscriber session of a fixed 4 hours from sign-in, with
  no sliding renewal (owner decision, 2026-11-04).
- **Revoked:** a session whose record has gone is ended when it's seen; one whose record is inactive
  lives on only to show the revoked view and sign out, and never reaches credentials.
- **The return page** shows that sign-in is completing, the picker, or an error that names the cause
  (no access, revoked, a missing or expired sign-in, Plex unreachable, the account couldn't be set
  up).

#### credentials

- **The URLs** come from the Dispatcharr username, the decrypted XC password and the public base
  URL: the public URL if set, otherwise the internal URL, in both cases only if it is HTTPS, with no
  loopback exception (a loopback URL is useless to a remote friend). A base URL that fails that
  gives no URLs at all (a public URL never falls back to the internal one), and the portal says an
  HTTPS public URL is needed. They are the playlist (`get.php`), player-API (`player_api.php`) and
  guide (`xmltv.php`) URLs, with the `/live/…` lines in the snapshot (D19); the credentials go in as
  they are, since generated passwords need no encoding.
- **The QR code** encodes the playlist URL and is drawn in the browser only on request; if it fails,
  the portal suggests copying the URL. Copying confirms success or says it failed.
- **The snapshot** is named after the username, never cached, and holds only the channels of the
  subscriber's effective groups, bucketed as `scoping` does (malformed means none), without
  channels that have no number or are hidden (D24), sorted by number, names cleaned. With no
  groups it is a header-only file. The portal says it won't update, and Dispatcharr's profiles stay
  the boundary at stream time. It is refused to the unprovisioned, the anonymous and the revoked.
- **Other states:** a provisioning problem shows its specific reason (not set up yet, no HTTPS
  public URL) and a Retry (the `route-portal` brief). The revoked view is `plex-sign-in`'s.
- **Retry** gives nothing a fresh sign-in wouldn't. A subscriber who isn't the owner is first
  checked, fresh, as an accepted Plex friend, the way sign-in does (`plex-sign-in`): one who isn't
  any more is disabled (D23) and gets nothing. Otherwise an Orphaned subscriber is provisioned
  again from their saved choices (`accounts`), audited as themselves, and anyone else is checked
  again.
- **Before any URL is shown,** the Dispatcharr user is checked. "Not found" clears the stale link,
  as rotating does (`accounts`), so the record is Orphaned and Retry works before the next sync; an
  unsafe user is fixed or disabled (D23).
- **The player guide** links each player in PRODUCT.md (Open TV, shipped as Fred.TV; IINA; VLC) to
  its project's own download page; nothing is looked up live. Every player gets the same playlist
  URL.

#### channel-choices

- **The page** follows the subscriber's policy: bundles with "your core lineup is always included",
  or groups whose changes apply right away. Its states: locked (their groups, read-only), nothing
  offered, the approved-selection picker warning when nothing is chosen, or the bundle choices.
  Saving goes through `scoping` and confirms; an error names its cause (managed by the owner, not
  fully set up, an invalid choice, Dispatcharr not configured).
- **The group picker,** shared with `plex-sign-in` and `subscriber-admin`: a search, how many are
  chosen and available, choose or clear all (only the matches while searching), rows with channel
  counts (hidden channels don't count, D24), empty and no-match states, at most about 300 rows drawn
  with a hint to narrow the search, and one Tab stop with arrow keys, Home and End, and Space or
  Enter.

#### subscriber-admin

- **The users table** has the count and "Subscribe myself"; a status filter (all, active, inactive,
  orphaned) and a case-insensitive search on the Plex or Dispatcharr name, both kept in the URL so a
  view can be shared; no paging (tens of users); and an empty state. When Dispatcharr is slow it
  falls back, after the interactive deadline, to the stored rows without drift or group data.
- **Drift** is a subscriber's Dispatcharr profiles differing from their stored effective groups;
  saving again or a sync fixes it.
- **Details** show every stored field and time, read-only.
- **Actions** (`accounts`): disable, enable, re-provision an Orphaned record from the friend's saved
  choices, remove permanently, rotate credentials, content flags (D22) and changing groups: the
  policy override, chosen bundles and approved groups, with the lock saved on its own, a summary of
  the effective policy, the effective groups and any intent not in effect, a warning when nothing
  would be granted, and live drift. Each says its consequence before it runs.
- **Subscribe myself** provisions the owner's own Streamer subscription, keyed on the Plex account
  behind the server token; it says so when one exists, and friend sync never removes it.

#### sync

- **One run, one lock:** the timer, "Run sync now" and the `m3u_refresh` webhook (D24) run the same
  four steps under one lock. A timed start that finds a run going is skipped and logged; a manual
  one is told a sync is already running. A webhook start that finds a run going queues one follow-up
  run after it, since the refresh may have re-enabled channels after that run read them. At most one
  run is queued, and later webhooks join it; it runs even if the current run fails. Steps 2–4 are
  isolated, so one failing never stops the next; if step 1 throws, the run fails.
  1. **Friends.** Find the owner's account and their friends (each retried). If either fails, record
     it, still write the completion entry, and stop. This step alone writes the run's one "sync
     completed" entry, with the report (unmapped, disabled, orphaned, refreshed, errors). Otherwise,
     leaving out the owner's own records and the owner, keep only accepted friends and for each
     record:
     - **no longer an accepted friend** (a pending friendship counts as ended): disable it (D23),
       even when it's already inactive, since its Dispatcharr user may have drifted back; an
       Orphaned record, with no Dispatcharr user, is still marked inactive and audited; counts move
       only on real changes;
     - **still a friend:** refresh the username (username, then title, then friendly name), email
       and avatar; check the Dispatcharr user (gone: its link is cleared, and an active record stays
       active as Orphaned while an inactive one stays Inactive; another error: recorded; found: copy
       a changed username); stamp it synced unless the check failed;
     - **an accepted friend without a record** is only counted: sync never provisions anyone;
     - **a Dispatcharr user with the marker but no record** is adopted or removed (D23).
  2. **Quarantine** (`lineup`), before subscriptions, so renamed quarantine groups are hidden in the
     same run.
  3. **Subscriptions:** enforce (`scoping`) and write the content flags (D22) for every active
     subscriber with a Dispatcharr user, from their intent; one person's failure is recorded and
     skipped.
  4. **Plugin checks** (`plugin-advisories`), last, so they see profiles made in this run.
- **Audit:** a manual run audits "sync started" with the owner as actor and answers with step 1's
  report; the other steps' results go to the log. A timed or webhook run, a queued one included,
  audits "sync started" with no actor. "Sync failed" is audited only when the whole run throws.
  Without the Dispatcharr URL, the key or the Plex token, the run is skipped with a log naming
  what's missing (by hand: it can't run until they're configured).
- **The timer:** every 15 minutes by default, 1 to 1,440 minutes. The interval is saved and read at
  startup, so a restart keeps it; saving it reschedules at once, the one way it changes while the
  app runs. Runs keep a fixed rate from the previous scheduled time, skip missed runs rather than
  bursting after a stall, never overlap and log errors without stopping the timer. Nothing runs at
  startup: the first sync is one interval after boot. Shutdown cancels the timer, clears a queued
  run and doesn't wait for a running sync.

#### audit-log

- **Filters,** kept in the URL: the action (the fixed list), actor or user text (matched literally,
  so underscores behave), page size (10, 25, 50 or 100) and after and before dates (whole days in
  the viewer's time zone). Changing a filter goes back to page one.
- **The table:** newest first, ties broken by id; each row expands to its detail (or says it has
  none) and shows the time, the actor ("system" when there is none), the action and the client
  address. Paging shows the range and page of total, and clamps a page out of range.
- **Retention:** a daily job removes entries older than the retention period (default 90 days, set
  by the owner in positive whole days, read on every run).

#### plugin-advisories

- **Cards,** one per plugin Dispatcharr reports, matched by key (D24); an unknown plugin gets a
  generic card. Each shows the plugin's name, whether it is on, its version, a one-line description
  and its advisories (info or warning), with states for Dispatcharr not configured or unreachable
  and for no plugins installed.
- **The ECM scope check** reads Event Channel Managarr's comma-separated profile list, works out
  which of otpravkarr's event profiles are missing from it and why (the plugin absent or off, no
  owned event profiles, or everything covered), and tells the owner what to add in Dispatcharr.
- **Read-only:** otpravkarr never writes a plugin's settings and never runs, enables or disables a
  plugin, and a test fails if such a call appears in the enforcement or check code.

#### overview

- **The dashboard:** the health tiles (`health`); users (total, active, inactive and orphaned,
  orphaned standing out above zero); the sync card (running or idle, the last run and its length,
  the four steps, and "Run sync now", which reports completion, error counts, a run already going or
  missing configuration, and after 30 seconds that it is still running in the background); the ten
  latest audit entries with a link to the log; and available friends: accepted friends without a
  record, from a 15-minute friends cache in memory, with a note that they get an account when they
  sign in. Nothing updates live: the data refreshes after a manual sync.

## Tech stack

The stack decisions are in [decisions.md](decisions.md) (D1–D12, D32). Versions are exact pins in
`package.json` (Bun from its `packageManager` field) and `bun.lock`; Dependabot moves them to the
newest stable release (D32). Every package is a dev dependency, so adapter-bun bundles it and
`bun ./build` needs no `node_modules`.

| Part | Package |
|---|---|
| Runtime and package manager | Bun |
| Language | `typescript` (6.x) |
| UI framework | `svelte` / `@sveltejs/kit` |
| Build | `vite` / `@sveltejs/vite-plugin-svelte` |
| Adapter | `@sveltejs/adapter-bun` |
| Styling | `@pandacss/dev`, `@pandacss/vite` (its Vite plugin), `@pandacss/preset-base` |
| Primitives | `@ark-ui/svelte` |
| Type check | `svelte-check` |
| Unit tests | `vitest` (`node` environment); `happy-dom` joins with the first component test |
| e2e | `@playwright/test` (Chromium) |
| Lint and format | `@biomejs/biome` |

Setup facts for this stack:
- SvelteKit 3 is configured through its Vite plugin (`vite.config.ts`); there's no
  `svelte.config.js`. `tsconfig.json` extends `$app/tsconfig`, which `svelte-kit sync` generates.
- Package subpath imports replace `$lib` and need explicit file targets: `#lib/*` maps to
  `./src/lib/*` and imports name the file with its extension (`#lib/server/services/health.ts`);
  `#styled-system/*` maps to the generated `./styled-system/*/index.js`.
- `svelte-kit sync` runs before Panda's codegen, in `prepare` and in `check`.
- The Panda Vite plugin appends the generated CSS to the stylesheet that declares the layer order
  (`src/app.css`), and `transform: true` turns static `css()` calls into class strings at build
  time.
- Hook types come from `@sveltejs/kit/hooks`.
- SvelteKit 3 exposes only the environment variables declared in `src/env.ts`.
- Tools run under Bun with `--bun`; a lifecycle script (`prepare`) calls each bin as
  `bun --bun <bin>`, because `bun ci` doesn't apply `--bun` to lifecycle scripts.
- Bun blocks `@parcel/watcher`'s install script (it builds with Node); Panda works without it.

## Commands

| Command | Does |
|---|---|
| `bun ci` | frozen install; `prepare` runs `svelte-kit sync` and Panda codegen |
| `bun run --bun dev` | Vite dev server; needs a key in `.env` or the environment, and without one every request fails with the key error |
| `bun run --bun build` | production build through adapter-bun into `build/`; needs no key and never embeds one |
| `bun run --bun preview` | runs the built server (`bun ./build`; `PORT`, default 3000, and `HOST`); without a valid key it exits before listening |
| `bun run --bun check` | `svelte-kit sync`, Panda codegen, then `svelte-check` failing on any error or warning |
| `bun run --bun test` | Vitest unit tests, once (no watch) |
| `bun run --bun smoke` | Playwright e2e: the browser smoke test and the startup tests, with a key it generates, never a developer's `.env` or exported key; it starts the built server, so `build` comes first, and Chromium comes from `bunx --bun playwright install chromium` |
| `bun run --bun lint` | `biome ci`, read-only; `biome.json` lists the file extensions Biome checks |
| `prek run --all-files --hook-stage manual` | everything CI's `checks` job runs |

## Project structure

The folder tree is in [AGENTS.md](../AGENTS.md#structure) and its rules in
[Code structure](../AGENTS.md#code-structure).

## Code style

Biome's defaults with the shared `biome.json` (tabs, double quotes, 100 columns). TypeScript strict;
`#lib/…` imports. File names and layout follow
[Code structure](../AGENTS.md#code-structure).

```ts
import { healthResponse } from "#lib/server/services/health.ts";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => healthResponse();
```

## Design tokens

- [`panda.config.ts`](../panda.config.ts) holds every design token: colours, type styles,
  spacing, radii, layout sizes, breakpoints and motion durations, under the names DESIGN.md uses.
  It replaced the seed token files that came with the design package.
- Colours are semantic tokens behind a colour-mode condition (`_dark`), dark by default
  (`class="dark"` on `<html>` in `src/app.html`); light values can be added later without touching
  components.
- Only `@pandacss/preset-base` is loaded (utilities and conditions), so no preset palette competes
  with the app's tokens, and `strictTokens` makes a raw value in `css()` a type error that `check`
  reports.
- The placeholder page uses only Panda tokens: no raw colour, size or font values in components.

## Testing strategy

- **Unit (Vitest, `node` environment):** the `/healthz` handler (status 200, body `ok`,
  `cache-control: no-store`) and the `secrets` module (`config/secret-key.test.ts`, and
  `key-text.test.ts`, `keyring.test.ts`, `cipher.test.ts` and `secret.test.ts` in
  `security/secrets/`, under `src/lib/server/`). Component tests use happy-dom when components
  exist; never jsdom.
- **e2e (Playwright, Chromium, under Bun):** against the built adapter-bun server, with a master key
  Playwright generates for each run, so CI needs no stored secret.
  - `smoke.test.ts` checks that `/` returns 200, shows the placeholder heading, hydrates (it waits
    for the `data-hydrated` attribute the root layout sets when mounted), applies the Panda
    background token and display text style and logs no console errors, and that `/healthz`
    returns `ok`.
  - `secret-key.test.ts` checks that the built server refuses to start without a valid key.
- prek runs the unit tests (`tests` hook); CI's `smoke` job builds with no key and runs `smoke`.

## CI and repo tooling

otpravkarr is a Bun web repo with edbfi-ci's Bun web templates:
- `.pre-commit-config.yaml`: Biome, `biome-migrate`, `check-peers`, the `tests` hook, plus a
  `check` hook (`bun run --bun check`), keeping the vendored-skill exclusions and the `docs-set`
  hook.
- `.github/workflows/ci.yml`: `checks` (prek), `smoke` (Chromium install, build, smoke) and `audit`
  (outside PRs); `checks` and `smoke` sit behind `ci-ok`, every job that installs runs with failing
  `node`, `npm` and `npx` on `PATH`, and the weekly run is `53 3 * * 0`.
- `.github/dependabot.yml` covers `github-actions`, `pre-commit` and `bun`, and
  `.github/workflows/biome-migrate.yml` applies Biome migrations and formatter output to
  Dependabot's Biome PRs.

## Boundaries

- **Always:** Bun with `--bun` for every tool; tokens only through Panda; keep SvelteKit's
  configuration in the Vite plugin; prek green before each commit.
- **Ask first:** any dependency not in the tech stack table; any change to `biome.json` (it is
  shared by the five rewrite apps); any CI shape that differs from the edbfi-ci template.
- **Never:** a database, authentication, Plex, Dispatcharr or any product feature before its
  module's approved spec builds it; a second styling tool or primitive library; Node, npm or npx
  anywhere, including CI.

## Success criteria

1. A fresh clone passes `bun ci`, `bun run --bun check` (zero errors and warnings), `bun run --bun
   test`, `bun run --bun build`, `bun run --bun smoke` and `prek run --all-files --hook-stage
   manual`, with no Node on `PATH`.
2. The built server (`bun ./build`) serves `/` with the placeholder page and `/healthz` with `ok`
   when started with a valid key.
3. `panda.config.ts` holds every design token; the seed token files are gone, and nothing in `src/`
   uses a raw colour, size or font value.
4. Only folders with real files exist; `#lib` resolves in app code, tests and `svelte-check`.
5. CI on the PR runs `checks`, `smoke` and `ci-ok` green; `audit` runs outside PRs.

## Ground-floor choices

1. **Fonts.** DESIGN.md wants Fraunces, Instrument Sans and IBM Plex Mono bundled locally. The
   skeleton defines the font tokens with system fallbacks; the first surface adds the font files (a
   dependency the owner approves then).
2. **Ark UI before its first use.** The skeleton installs `@ark-ui/svelte`, so the Panda and Ark
   pairing and `check-peers` are settled early; the first `ui/` wrapper comes with the first surface
   that needs one.
3. **Security headers and CSP.** The legacy app set a strict CSP and security headers ([Module
   notes](#module-notes), `setup`). They belong to the first module that serves real pages
   (`setup`, whose claim page comes before `sign-in`), not the skeleton.
4. **Health.** `/healthz` always answers `ok`. The health module replaces it with the public `ok`,
   `degraded` or `unhealthy` of its [Module notes](#module-notes), from real Plex, Dispatcharr and
   database checks.

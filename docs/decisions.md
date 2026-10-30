# Decisions

Each entry is a decision and why it was made. Open entries keep their number when they're settled.
The stack entries are the stack every edbfi rewrite app shares
([Shared groundwork](../AGENTS.md#shared-groundwork)), cut down to what applies to otpravkarr.
Versions live in `package.json` and `bun.lock`.

## Decided

### D1. SvelteKit on one origin

Svelte 5 and SvelteKit 3, with TypeScript for browser and server code. SvelteKit serves pages, form
actions, API endpoints and assets on one origin, with server rendering on and interactive components
in the browser. Backend work happens in server routes, server `load` functions and form actions,
which call application services.

Why: one framework and one origin for both surfaces (portal and admin console) keeps sessions,
origin checks and deployment simple, and all five apps share it.

### D2. TypeScript 6, strict

The latest stable TypeScript 6.x at bootstrap, locked; no prereleases, and major upgrades wait until
the Svelte tooling supports them. Strict type checking, run explicitly (the `check` script): running
TypeScript under Bun doesn't type-check it. External input is validated at runtime.

Why: [SvelteKit 3 requires TypeScript 6](https://svelte.dev/docs/kit/migrating-to-sveltekit-3#Updated-dependencies).

### D3. Bun everywhere, no Node

Bun is the runtime and package manager in development, CI and production. Tools run with `--bun`
(`bun run --bun`, `bunx --bun`) so their Node shebangs don't apply; no `node`, `npm` or `npx`.
Packages still come from the npm registry. `bun.lock` is committed and CI installs with
`bun install --frozen-lockfile`.

Why: one runtime for every step, and the official Bun adapter needs it.

### D4. One container, one process, one port

[`@sveltejs/adapter-bun`](https://svelte.dev/docs/kit/adapter-bun) builds a Bun server. otpravkarr
runs as one application process with one HTTP port in one container; container packaging lives in
the separate `otpravkarr-docker` repository. Secrets are configured separately from the database and
used only in server-only code.

Why: a single self-hosted instance for one owner and tens of users doesn't need more, and in-memory
state (sign-in handshakes, rate limits, the scheduler lock) can assume one process (see D17).

### D5. Embedded Turso through Drizzle

The database is embedded Turso (`@tursodatabase/database`) through Drizzle
(`drizzle-orm/tursodatabase/database`), with the database file on a persistent data volume. Drizzle
Kit generates SQL migrations, which are reviewed and committed. Migrations run before the app
accepts requests or starts jobs, with one migration owner per database.

Drizzle must be `1.0.0-rc.5-5935859` (the verified reference, D15) or a later release that keeps its Turso transaction fix (Drizzle
[`25abe07`](https://github.com/drizzle-team/drizzle-orm/commit/25abe0785e09cb562d999c9b6b8d92d85e3e7053),
using the API from [Turso #7898](https://github.com/tursodatabase/turso/pull/7898)). Never
`1.0.0-rc.4`: it can roll back unrelated writes that share the connection, and upgrading Turso alone
doesn't fix it.

Why: one file on one volume matches the one-process deployment and keeps backup simple; the
rollback-isolation check passed with the fixed adapter and no application-level write queue.

### D6. Transactions and data access

Database access sits behind named operations (save a connection, claim a due job). Application
services own the business rules and the transaction boundaries. Every statement in a transaction
goes through the callback's transaction object; transactions stay short, and network calls happen
outside them. No generic layer that promises interchangeable SQL dialects.

Why: Turso transactions use async callbacks, and a statement outside the transaction handle escapes
it. otpravkarr targets one engine, so a dialect abstraction would be cost without benefit.

### D7. In-process background jobs

Jobs (sync, health, housekeeping) belong to application startup and shutdown, never to page
requests. Job state is persisted so work recovers after a restart, runs never overlap, and retries
are safe.

Why: SvelteKit and Drizzle provide none of this lifecycle, and the legacy app's lazy, first-request
startup let a misconfigured instance look healthy.

### D8. SSRF-safe outbound HTTP

Every outbound call goes through server-side `fetch` with explicit address validation and a redirect
policy.

Why: the Plex and Dispatcharr addresses are admin-supplied, so the server must not become a proxy to
arbitrary hosts.

### D9. Generated HTTP API clients

Typed HTTP API clients come from `@hey-api/openapi-ts`, generated from the app's own OpenAPI
document during the build. Generated files are never edited by hand. Page loads and form actions use
SvelteKit's generated types instead; services call database operations directly.

Why: one typed contract for the JSON endpoints, without hand-written client code drifting from it.

### D10. Panda CSS and Ark UI only

Styling is Panda CSS 2 through its Vite plugin, with build-time transforms on. Accessible primitives
come from Ark UI for Svelte, unstyled and styled with Panda tokens. Design tokens are defined once,
in Panda's configuration, which loads only `@pandacss/preset-base` (utilities and conditions, no
preset palette) and sets `strictTokens`, so a raw value in a component fails type checking. No
second styling tool or primitive library.

Why: one token source and one primitive library keep the design system (DESIGN.md) enforceable.

### D11. Structured logs to standard output

Logs are structured, one entry per line, written to standard output. The library is open (D14).

Why: the container runtime collects stdout; structured lines can be filtered without parsing prose.

### D12. Plex through `@ctrl/plex` behind a provider

otpravkarr uses [`@ctrl/plex`](https://github.com/scttcper/plex) wherever it supports the needed
behaviour, and Bun's `fetch` only for missing endpoints or app-specific variations, after checking the
library's implementation. Both sit behind one server-only Plex provider: services call methods such
as `listFriends()`, never build Plex requests. The provider applies consistent timeouts, error
handling and runtime response validation. Each custom method documents the missing library
behaviour beside it and is revisited when the library gains it. The
[official Plex API specification](https://developer.plex.tv/) is the reference for Media Server
operations, and `@hey-api/openapi-ts` may generate types or calls from a pinned copy; there's only
ever one implementation of an operation.

otpravkarr's Plex scope is sign-in, account identity, friends, server discovery and health. An
accepted friendship grants IPTV eligibility; a pending invitation doesn't. Dispatcharr is a separate
integration.

Why: a maintained library covers most operations, and one provider boundary keeps the access rules
(friendship, not server share) explicit and testable.

### D19. Friends get per-user XC URLs only; otpravkarr warns about Dispatcharr exposure

otpravkarr hands friends only per-user XC URLs: `get.php`, `player_api.php`, `xmltv.php` and the
`/live/…` lines they contain. It never hands out Dispatcharr's `/output/*`, `/hdhr/*` or `/proxy/*`
URLs.

How Dispatcharr is reachable from the internet is the owner's setup, not otpravkarr's to fix.
otpravkarr's docs tell the owner to expose only the XC and artwork paths, following Dispatcharr's
[reverse-proxy guide](https://github.com/Dispatcharr/Dispatcharr-Docs/blob/192061c43443365771425d114484608cc3d01f51/docs/en/reverse-proxies.md). otpravkarr's
Dispatcharr health check has one exposure item: it sends `HEAD /output/m3u` and
`GET /hdhr/discover.json` to the public Dispatcharr URL, anonymously and without following redirects.
A 2xx answer is a red warning with the fix. Anything else is neutral ("not reachable from here"),
with a tip to open the playlist URL on a phone off Wi-Fi. The check never reports the setup as safe,
and otpravkarr changes no Dispatcharr setting.

Why: those paths take no credentials and can't be revoked per person. Reachable from the internet,
they expose the lineup and, through `/output/m3u?direct=true` and Redirect-mode `/proxy` streams, the
provider's credentials. Behind a reverse proxy, Dispatcharr's local-only rule can admit everyone (a
missing or client-supplied `X-Real-IP`), so a path allowlist at the proxy is the reliable fix. From
the owner's network otpravkarr can't prove that strangers are locked out, so it warns about visible
exposure instead of certifying safety.

### D21. Subscribers are stream-only; everything goes through otpravkarr

Every subscriber's Dispatcharr user is a Streamer (`user_level` 0). Its Dispatcharr login password
is random, never stored or shown, and separate from `xc_password`, so no subscriber can sign in to
Dispatcharr's web UI or REST API. Subscribers never need Dispatcharr: what they can see and change
(credentials, channel groups, bundles) is in otpravkarr, inside the limits the owner sets there.
otpravkarr has one provisioning mode; the legacy self-managed and staff modes are dropped. The
owner's self-subscription is a Streamer like everyone else. otpravkarr doesn't proxy or re-sign
playlists or streams.

Why: Standard, the legacy "highest non-admin level", can sign in to Dispatcharr and see channels
outside its profiles, provider stream URLs (v0.32.0), every plugin's settings and DVR recordings.
Streamer is the XC-only level, and channels default to level 0, so XC loses nothing. The self-managed
and staff modes need a Standard-or-higher user with a known password, which breaks that. Proxying
would hide nothing (each stream line carries the XC credential), and serving video is a non-goal.

### D22. Least-privilege content defaults: no movies or series unless the owner turns them on

otpravkarr writes `vod_movies_enabled`, `vod_series_enabled`, `catchup_enabled`,
`hide_adult_content` and `stream_limit` on every managed user, on create and on every sync. The
defaults are movies and series off, catch-up off, adult content hidden and a stream limit of 2. The
owner can change each one for all subscribers or for chosen ones; subscribers see what they have but
can't change it.

Why: channel profiles don't scope movies and series, and Dispatcharr turns them on for every user by
default, so without this every friend gets the owner's whole library. The owner wants it off unless
they choose otherwise. `stream_limit` is the only brake on a shared credential; 2 covers a TV plus
one other device.

### D23. Profiles and the subscriber lifecycle

- **Empty profiles from the start.** Every profile otpravkarr creates is created with
  `start_empty: true`.
- **Disable keeps the account.** Disabling a subscriber (by the owner, or by sync when the friendship
  ends) clears `xc_password` and leaves only the empty profile. The Dispatcharr user is deleted only
  when the owner removes the person permanently.
- **Ownership marker.** Every managed user carries
  `custom_properties.otpravkarr = {instance, plex_account_id}`, moving to Dispatcharr's app-data API
  once it's released. Sync uses it to find, adopt or remove users otpravkarr created but has no record
  of.
- **Unsafe users are incidents.** A managed user with an empty `channel_profiles` list or
  `user_level >= 10` is an incident. Sync and credential display check for it, and fix the user or
  disable it first.

Why: a new profile otherwise starts with every channel until it's narrowed. Disabling by clearing
`xc_password` stops every XC path, can be undone and keeps the Dispatcharr ID, where the legacy
disable-by-delete churned users and left orphans when a local write failed. An empty profile list
shows a non-admin user every channel, and deleting a profile in Dispatcharr can cause one.

### D24. Keeping access from widening behind otpravkarr's back

- **Auto-sync groups.** otpravkarr reads Dispatcharr's M3U auto-sync group settings and warns about
  any group whose Channel Profiles is blank (all profiles). Its docs tell the owner to scope each
  auto-sync group or set it to "No Profiles".
- **Reconcile on refresh.** Dispatcharr's Connect `m3u_refresh` webhook, with a shared-secret
  header, triggers a reconcile; the timer stays as the safety net.
- **Plugins.** otpravkarr warns when a plugin's profile setting names a profile otpravkarr owns
  (Event Channel Managarr scoped to event profiles is the expected exception). The plugin registry
  reads `epg_and_sports_editor` (keeping `epgeditarr` as an alias), accepts dashed keys and merges
  each field's default before reading settings.
- **Hidden channels.** Channels marked `hidden_from_output` count as absent in pickers, counts and
  the playlist snapshot.

Why: every M3U refresh re-enables auto-synced channels in every profile, otpravkarr's and the empty
one included, and channels created through the UI or API join every profile. Event Channel Managarr
and Lineuparr would widen a profile otpravkarr owns, and Stream Mapparr would narrow it. The legacy
plugin registry missed the renamed EPG plugin and misread settings left at their defaults.

### D25. otpravkarr's own Dispatcharr credentials

otpravkarr uses the API key of a dedicated Dispatcharr admin user, not the owner's own account, with
that user's `allowed_networks.UI` pinned to otpravkarr's address. It sends the key as `X-API-Key`,
strips `api_key` from every user payload where responses are validated, and never logs user
responses.

Why: Dispatcharr API keys are full-admin, unscoped, stored in plaintext and never expire, and every
admin user-list response carries every user's key.

### D26. Dispatcharr versions and health

- **Version.** otpravkarr reads `GET /api/core/version/` (no authentication) and warns when
  Dispatcharr isn't the latest stable release it is tested with (D30). `start_empty` and "No
  Profiles", which otpravkarr needs, exist from v0.30.0, so every release it supports has them.
- **Contract tests.** The Dispatcharr operations otpravkarr uses run in CI against the latest
  stable Dispatcharr image (D30), with a snapshot diff of `/api/schema/`.
- **Health probe.** `GET /api/core/version/` plus one cheap authenticated call, such as reading the
  empty profile; never the user list.
- **No fake-credential probes.** Setup and health checks never try XC with made-up credentials.

Why: Dispatcharr's API is unversioned and still 0.x, and a minor release every 2–5 weeks routinely
changes behaviour otpravkarr depends on. The legacy probe fetched every user and API key. Dispatcharr
dev adds failed-auth rate limits for XC and API keys, which fake-credential probes would trip.

### D27. Shared opening modules and owner sign-in, in the same shape in every app

Every edbfi rewrite app builds five modules before any feature module, in this order: `secrets`,
`i18n`, `setup`, `sign-in`, then `two-factor`. Each app also gets `oidc-sign-in` later. These
modules have the same shape in all five apps, so signing in works the same way everywhere; each app
keeps its own copy ([Shared groundwork](../AGENTS.md#shared-groundwork)).

- **One owner.** Each instance has exactly one owner account, with no other roles: no co-admins,
  viewers or operators, and none planned for later.
- **`secrets`.** Secret values are encrypted in the app before they reach the database, with
  AES-256-GCM through WebCrypto, so this works on any database engine:
  - The key is 32 random bytes from an environment variable or a secret file. It is never derived
    from a password, and a missing or malformed key stops the app at startup.
  - Every encryption uses a fresh random 12-byte nonce.
  - Associated data ties each value to its record and field, so a value copied to another row or
    field fails to decrypt.
  - Every stored value carries its key ID, so a value written under another key fails with its
    own error (D31).
- **`i18n`.** The translation groundwork (D28), in place before the first screen.
- **`setup`.** If nobody has claimed the instance yet, the app prints a one-time bootstrap token to
  the console at startup, outside the structured logs (D11). Whoever types that token claims the
  instance and creates the owner account. After that, the claim no longer exists: its page answers
  "not found". `sign-in` adds signing the new owner in at the claim, as `two-factor` adds its offer,
  so the rest of first run, the steps later modules add, happens signed in.
- **`sign-in`.** The owner signs in with the username and password created in `setup`. Sessions
  are server-side, and only a hash of each session token is stored.
- **`two-factor`.** Optional, but strongly recommended: first-run setup offers it right after the
  owner account is created, before any connection step, and the admin shell keeps reminding the
  owner until it is on. It uses authenticator-app codes (TOTP), with
  the secret encrypted by `secrets`, single-use backup codes stored only as hashes, each code
  accepted once and a limit on failed attempts. When it is on, every way of signing in passes
  through it, with one optional exception for OIDC (below).
- **Recovery.** An owner who loses their password, or their authenticator and backup codes, turns on
  a recovery setting in the environment and restarts the app. It then prints a one-time recovery
  token to the console, outside the structured logs, as `setup` does. Typing the token lets the
  owner set a new password; it also turns two-factor off, so they can set it up again, and signs out
  every session. The token expires after 15 minutes (a restart prints a new one), failed attempts
  are limited per address, and once it is used the app prints no new one while the setting stays on,
  and warns at startup that the setting should be cleared. `sign-in` builds it, and `two-factor`
  adds turning itself off.
- **Plex for the owner is an option.** In the apps that use Plex (all of them except comradarr and
  zimuarr), the owner can link their account to their own Plex account in the admin settings once
  setup is done. After that, "Sign in with Plex" also signs them in as the owner. The password
  keeps working, and Plex sign-in for the owner stays off until they link. Where an app has users
  besides the owner, those users sign in with Plex.
- **`oidc-sign-in`.** The owner can also link their account to one OpenID Connect provider, such as
  Authentik, Authelia, Pocket ID or Tinyauth, which then signs them in as the owner. It uses
  discovery and the authorization code flow with PKCE, and keys the link on the provider's issuer
  and subject. As with Plex, linking never creates an owner, and the password keeps working.
  Signing in through a reverse proxy's headers isn't supported.
  - **The provider's own second factor can replace the app's, if the owner chooses.** When the ID
    token's `amr` claim (RFC 8176) reports that the owner used a second factor at the provider,
    such as Authentik's or Authelia's TOTP or a passkey, the app offers to skip its own two-factor
    for OIDC sign-ins. It stays on until the owner accepts. Every OIDC sign-in checks the claim
    again, and one that reports no second factor goes through the app's two-factor. Password and
    Plex sign-ins always do. A provider that doesn't send `amr` never gets the offer.

Each app's connection modules add their own first-run steps after `setup`, such as connecting Plex
and Dispatcharr here.

Why: the owner wants the five apps to look and work alike, and everything else depends on these
modules: every app stores upstream secrets, shows text that must be translatable, needs a safe first
claim and has to know who its owner is. Encrypting in the app (D4: secrets are configured apart from
the database) keeps stolen database files unreadable without the key. Two-factor and OIDC sign-in
were the owner's call for every app, and so was letting a provider's own second factor stand in for
the app's, optionally; one standard OIDC flow covers the self-hosted identity providers without a
client for each, and `amr` is the standard way to see the provider's factor. Recovery was the
owner's call for every app too, after comradarr's legacy recovery mode showed that the opening had
no way back in. Associated data, key IDs and hashed session tokens fix weaknesses listed in legacy
spec §12.

### D28. Every interface is translatable, in English and Danish

Every edbfi app is built for translation from its first screen. No user-facing text is written into
components or services: it comes from message files, one per language. English is the source
language and the default, and Danish is the second language. Each request uses the viewer's own
choice, then the browser's preferred languages, then English. Dates, times and numbers are formatted
for the viewer's locale through `Intl`, never in a fixed format. The message files use a format
Weblate reads, plurals included, so a Weblate project can be connected later without changing code.
Connecting Weblate is later work and belongs to no module yet. British spelling stays the English
default, as in the legacy app. Lineup names come from the owner's configuration and aren't
translated.

Why: the owner wants full translation support in every app, with Weblate as the translation tool,
and English and Danish now. Adding translation afterwards touches every screen; building it in from
the first one costs little. The legacy app was British English only, with en-GB dates (legacy
spec §8.4).

### D29. Paraglide JS with i18next JSON v4 messages

Translation (D28) uses Paraglide JS 2 (`@inlang/paraglide-js`) through its Vite plugin, SvelteKit's
official i18n integration. Messages live in `messages/en.json` and `messages/da.json` in i18next
JSON v4, through `@inlang/plugin-i18next` 6.2.0 or later (which fixed its plural handling), with
plurals under CLDR suffixes. Weblate reads that format as "i18next JSON v4" (`i18nextv4`),
monolingual, with `messages/en.json` as the base file.

- Components and services call the typed message functions Paraglide compiles, so a missing
  message is a type error. The compiled output is generated and gitignored.
- On the server, `paraglideMiddleware` in `hooks.server.ts` picks each request's language (the
  viewer's cookie, then the browser's preferred languages, then English) and keeps it in
  AsyncLocalStorage, so concurrent requests can't mix languages. Under SvelteKit 3 it passes the
  translated request on a copy of the event, because `event.request` is read-only.
- Dates, times and numbers stay with `Intl` (D28).

Still to validate in the `i18n` module: the pinned versions with SvelteKit 3, TypeScript 6 and Bun;
building and serving through adapter-bun (Paraglide issue
[#725](https://github.com/opral/paraglide-js/issues/725) reports the middleware returning nothing in
builds that use instrumentation); and a Weblate round trip of a plural message.

Why: it is the integration SvelteKit itself points to. Compiled, tree-shaken message functions add
almost nothing to the bundle and are checked by strict TypeScript. A language per request through
AsyncLocalStorage is safe for server rendering. i18next JSON v4 is a native Weblate format with
correct plurals for English and Danish. gettext PO (through wuchale or Lingui) would also carry
notes for translators, which i18next JSON v4 can't, but those integrations are younger and keep the
language in stores, which need care when the server renders concurrent requests; svelte-i18n
resolves messages at runtime, without typed messages. The owner left the choice to the agents.

### D30. Other software: the latest stable release only

Each edbfi app works with the latest stable release of every service it talks to, and with nothing
older. Its contract tests run against that release; when a new stable release ships, the tests and
the app move to it in the app's next release, and support for the one before goes. The app adds no
code for older versions and no workarounds for upstream bugs that a later release may fix: a bug
that harms users is reported upstream and named in the app's docs. A service on any other version
(older, newer than the one tested, a prerelease, or a version the app can't read) keeps working, and
the app tells the owner plainly which version it is tested with, in setup and on the owner's own
status screens; the public health endpoint never shows a version. Responses are still validated, so
a real difference in the API shows up as an error, not as wrong data.

In otpravkarr the services are Dispatcharr and Plex Media Server. Dispatcharr's version check and
contract tests follow this rule (D26), so Dispatcharr has no version floor or supported range. Plex
Media Server is held to its latest public release in the same way; Plex's account service has no
version to check. The warning shows on the health tiles of `/admin` (`health`).

Why: the owner doesn't want a backlog of backwards compatibility in any app (owner decision). Code
for old versions and for upstream bugs is seldom removed once it's in, and each workaround outlives
the upstream fix as code to maintain. Warning instead of refusing keeps users who update a week
late working.

### D31. The master key: its format, its checks, and when it's required

`secrets` (D27) takes one master key, exactly 32 bytes in canonical standard base64, from
`OTPRAVKARR_SECRET_KEY` or `OTPRAVKARR_SECRET_KEY_FILE`; setting both is an error, and an empty
variable counts as unset. Startup refuses a key whose bytes have at most 4.0 bits of Shannon entropy
per byte, step by one constant amount, or are all printable ASCII; there is no denylist. The key is
imported only as HKDF input, and each use derives its own key under its own label: the AES-256-GCM
key and a 16-byte key ID. A stored value is one text value,
`v1.<key id>.<nonce>.<ciphertext and tag>`, with `NULL` for none, and decrypts only under the table,
field, row and app it was written for. The `Secret` wrapper keeps plaintext out of logs, errors and
JSON, and `reveal()` is the only way to read it. There is no rotation: the key ID D27 asks for makes
a value written under another key fail with its own clear error, and a new key means entering the
stored secrets again. `secrets` checks the key in SvelteKit's `init` hook from its first version, so
every way of running the app, dev and CI included, needs one. The key is restored with the database
file (D16). The legacy master secret (legacy §9.2, §10: hex, base64 or raw text of at least 32
bytes, with per-purpose keys derived from it) goes with it. The details are in
[SPEC-secrets.md](SPEC-secrets.md). The design is the same in all five edbfi apps; only the variable
prefix, the app name and the stored secrets differ.

Why: the shared opening keeps `secrets` the same in every app (D27), and comradarr settled its
design first, with safety first (owner decision, after a council of three models and a review). Each
check catches a real mistake (a padded or doubled short secret, a counter, a passphrase), and
together they refuse a random key about once in 62 billion. A denylist adds upkeep without safety
once no key is ever written in the repo. One encoding and an error when both variables are set leave
nothing ambiguous at startup. An empty variable can't hold a key or a path, and Compose writes one
for every `${VAR}` that isn't defined, so counting it as set would only break the usual secret-file
setup (owner decision). HKDF keeps the master key out of every primitive but one, so later
uses can derive their own keys safely. One self-describing column can't come apart. The wrapper
joins every app, not only comradarr (owner decision). Rotation is left out because the apps are
rewritten from scratch with no stored data to carry over, and a key change is rare enough to handle
by entering a few secrets again (owner decision). Checking the key from the first version makes it
part of installing otpravkarr from the start, rather than a surprise when a later module first
stores a secret.

## Open

### D13. Producing the OpenAPI document

How the OpenAPI document is generated from SvelteKit endpoints isn't chosen. The generator must be
validated with the pinned TypeScript 6 and Bun versions. Closes when the first JSON endpoint needs a
generated client.

### D14. Logging library and job lifecycle

The logging library (D11) and the concrete job lifecycle implementation (D7) aren't chosen. Close
before the first background job lands.

### D15. Turso and Drizzle versions

The exact Drizzle ORM and Drizzle Kit pair for Turso is still to be validated in the app: migrations,
type checking, production builds and rollback isolation (D5). Only a focused rollback-isolation check
has passed (Drizzle `1.0.0-rc.5-5935859` with Turso `0.8.3` and `0.9.0-pre.1`). Closes with the first
database module.

### D16. Runtime validation gaps

Not yet validated for this stack: browser interaction with a real component, production containers,
realistic load, and job recovery after a restart. Hydration is validated: the e2e smoke test waits
for the hydrated app in Chromium against the built server, with no console errors.
A crash test doesn't prove recovery from power loss or storage faults. The Turso backup and restore
procedure is still to be defined and tested; the master key is restored with the database file
(D31). Each closes with the work that first depends on it.

### D17. One process

The deployment assumes one application process per database. Horizontal scaling and job
coordination across processes would need a new design. Stays open as an accepted limit.

### D18. Plex library audit

The Plex operations otpravkarr needs (D12) still have to be audited against a pinned `@ctrl/plex`
version, checked for Bun and TypeScript 6 compatibility, and tested for request payloads and
response parsing. Sign-in and the friends list must be verified against Plex before they replace a
working flow. Closes with the Plex provider.

### D20. Dispatcharr exposure: scope and a better approach

D19 is the simple version; the owner expects a better overall approach may exist. To investigate:

- Scope: how much otpravkarr's docs say beyond pointing to Dispatcharr's guide (its own path list, a
  Caddy example), and how the exposure item fits the Dispatcharr health check (when it runs, how it
  is shown).
- Dispatcharr dev moves XC streams from the `STREAMS` to the `XC_API` network rule. Once released,
  the owner can limit `STREAMS` (`/proxy/*`) to the LAN without breaking friends, and Dispatcharr's
  own settings may cover most of the risk.
- Upstream proposals: a token, login or off switch for `/output`, `/hdhr` and `/proxy`, and not
  trusting a client-supplied `X-Real-IP`.
- Reading, not writing, Dispatcharr's network-access settings to warn about risky values.

Closes with the Dispatcharr feature spec.

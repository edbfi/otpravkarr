# Decisions

Each entry is a decision and why it was made. Open entries keep their number when they're settled.
The stack entries come from the shared rewrite recipe used by all five edbfi apps, cut down to what
applies to otpravkarr. Versions live in `package.json` and `bun.lock`.

## Decided

### D1. SvelteKit on one origin

Svelte 5 and SvelteKit 3, with TypeScript for browser and server code. SvelteKit serves pages, form
actions, API endpoints and assets on one origin, with server rendering on and interactive components
in the browser. Backend work happens in server routes, server `load` functions and form actions,
which call application services.

Why: one framework and one origin for both surfaces (portal and admin console) keeps sessions,
origin checks and deployment simple, and it's the recipe all five apps share.

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

- **Version floor v0.30.0**, the first with `start_empty` and "No Profiles". otpravkarr reads
  `GET /api/core/version/` (no authentication) and gates on a supported range, warning above the
  newest tested version.
- **Contract tests.** The Dispatcharr operations otpravkarr uses run in CI against pinned Dispatcharr
  images (the floor and the latest tested), with a snapshot diff of `/api/schema/`.
- **Health probe.** `GET /api/core/version/` plus one cheap authenticated call, such as reading the
  empty profile; never the user list.
- **No fake-credential probes.** Setup and health checks never try XC with made-up credentials.

Why: Dispatcharr's API is unversioned and still 0.x, and a minor release every 2–5 weeks routinely
changes behaviour otpravkarr depends on. The legacy probe fetched every user and API key. Dispatcharr
dev adds failed-auth rate limits for XC and API keys, which fake-credential probes would trip.

### D27. Shared opening modules and owner sign-in, in the same shape in every app

Every edbfi rewrite app builds five modules before any feature module, in this order: `secrets`,
`i18n`, `setup`, `sign-in`, then `two-factor`. Each app also gets `oidc-sign-in` later. These
modules have the same shape in all five apps, so signing in works the same way everywhere. Each
app keeps its own copy; there is no shared package.

- **One owner.** Each instance has exactly one owner account, with no other roles: no co-admins,
  viewers or operators, and none planned for later.
- **`secrets`.** Secret values are encrypted in the app before they reach the database, with
  AES-256-GCM through WebCrypto, so this works on any database engine:
  - The key is 32 random bytes from an environment variable or a secret file. It is never derived
    from a password, and a missing or malformed key stops the app at startup.
  - Every encryption uses a fresh random 12-byte nonce.
  - Associated data ties each value to its record and field, so a value copied to another row or
    field fails to decrypt.
  - Every stored value carries its key ID, so the key can be rotated.
- **`i18n`.** The translation groundwork (D28), in place before the first screen.
- **`setup`.** If nobody has claimed the instance yet, the app prints a one-time bootstrap token to
  its log at startup. Whoever types that token claims the instance and creates the owner account.
  After that, setup no longer exists: its routes answer "not found".
- **`sign-in`.** The owner signs in with the username and password created in `setup`. Sessions
  are server-side, and only a hash of each session token is stored.
- **`two-factor`.** Optional, but strongly recommended: first-run setup offers it right after the
  owner account is created, before any connection step, and the admin shell keeps reminding the
  owner until it is on. It uses authenticator-app codes (TOTP), with
  the secret encrypted by `secrets`, single-use backup codes stored only as hashes, each code
  accepted once and a limit on failed attempts. When it is on, every way of signing in passes
  through it, except where an `oidc-sign-in` spec decides to trust the identity provider's own
  second factor.
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

Each app's connection modules add their own first-run steps after `setup`, such as connecting Plex
and Dispatcharr here.

Why: the owner wants the five apps to look and work alike, and everything else depends on these
modules: every app stores upstream secrets, shows text that must be translatable, needs a safe
first claim and has to know who its owner is. Encrypting in the app (D4: secrets are configured
apart from the database) keeps stolen database files unreadable without the key. Two-factor and
OIDC sign-in were the owner's call for every app; one standard OIDC flow covers the self-hosted
identity providers without a client for each. A copy per app is enough for five apps and avoids
building a shared package before it's needed (YAGNI). Associated data, key IDs and hashed session
tokens fix weaknesses listed in legacy spec §12.

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
procedure is still to be defined and tested; the database file and the secrets must be restored
together. Each closes with the work that first depends on it.

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

### D29. Translation library and message format

Which translation library (D28) and which Weblate-readable file format to use isn't chosen. One
candidate is Paraglide JS storing its messages as i18next JSON; gettext PO and XLIFF are others.
The choice must work with SvelteKit 3 on Bun, with server rendering, plurals and TypeScript 6.
Closes with the `i18n` module.

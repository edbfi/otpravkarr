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

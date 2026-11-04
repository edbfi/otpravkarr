# Spec: otpravkarr

**Status:** the ground floor (skeleton) is specified here, approved by the orchestrator
(2026-10-18) and built. The capability map below is approved; module 1, `secrets`, is built
([SPEC-secrets.md](SPEC-secrets.md)).

## Objective

otpravkarr lets the accepted Plex friends of a server owner sign in with Plex and get their own
scoped IPTV account on the owner's Dispatcharr, through a subscriber portal and an owner console
([PRODUCT.md](../PRODUCT.md), [legacy spec](product/legacy-spec.md)).

**This spec covers only the ground floor:** an empty, production-shaped SvelteKit app that builds,
type-checks, tests, lints and serves on Bun, styled from the design tokens, with the edbfi Bun web
CI around it. It has no database, authentication, Plex, Dispatcharr or product features. Its job is
to make the first module spec cheap to build: every later PR adds behaviour, not plumbing.

## Capability map

**Status:** approved by the owner (2026-10-23), with the shared opening widened on 2026-10-24
(D27; shared rows aligned 2026-10-30). Module ids never change. Each module gets its own
`docs/SPEC-<id>.md`, which the owner approves just before it is built.
Sources: [PRODUCT.md](../PRODUCT.md), [decisions.md](decisions.md), the
[legacy spec](product/legacy-spec.md), the [Dispatcharr research](research/dispatcharr.md), the
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
| 15 | `subscriber-admin` | Users table with filters and drift, details, disable, enable, remove, rotate, changing groups and the lock, per-person content flags, and "Subscribe myself", keyed on the Plex account behind the server token (legacy §4 and §6.2), so it needs no owner Plex link. How the owner opens that subscriber view is settled in this module's spec | `accounts`, `lineup`, `plex-connection` | `/admin/users` |
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
| `sign-in` | `services/sign-in/` (sessions and their storage, recovery), `db/` session schema, `security/` (session-token and password hashing, rate limiting, the cross-origin check), `vite.config.ts` (SvelteKit's own form check off); the sign-in at the claim in `routes/setup/`, `routes/(admin)/` layout, `lib/components/layout/` |
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
- `sign-in`: how long an owner session lasts.
- `sign-in`: the password rules: the minimum length, whether a list of common passwords is
  refused, and how repeated failed sign-ins are slowed beyond the rate limits (backoff, or a lockout
  where the app's approved docs allow one).
- The first module with a background job closes the job half of D14: `sign-in` if its session
  cleanup is a job, otherwise `health`.
- `plex-connection`: D18. `health`: D20 (the exposure item belongs to the Dispatcharr health check,
  D19).
- D13: no module here needs a generated API client yet. D17 stays open as an accepted limit.

### Left out on purpose

- Self-managed and staff modes, and the Change Profile action, which only made sense for them
  (D21).
- The setup "Defaults" step (nothing used it, legacy spec §12, and the default mode went with
  D21).
- The admin friends and detailed health APIs, and the unlinked owner "where would you like to go?"
  page (no consumer, legacy spec §12).
- Any role beyond the one owner (owner decision).
- Signing in through a reverse proxy's headers (D27): `oidc-sign-in` covers the same identity
  providers.
- Connecting Weblate (D28): later work, outside this map. The message files are ready for it.
- Recognising the owner automatically as the Plex account behind the server token (legacy spec
  §6.2). The owner links their Plex account themselves, if they want to (D27, owner decision).
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
are needed (the last two are in the legacy app and in PRODUCT.md's admin shell) but have no
brief. Each gets one before its module is specced.

### Module notes

What a capability-map row commits to in more detail than a clause fits. It is behaviour to keep
unless the module's approved spec or a decision changes it, and each block moves into its module's
`SPEC-<id>.md` when that module is specced. `setup` and `sign-in` are shared with the other edbfi
apps (D27), with obzorarr as their reference: a bullet or clause marked "(otpravkarr)" is this app's
own, and the rest is the shared wording; a "(otpravkarr)" mark inside a bullet covers the rest of
that bullet, and "(otpravkarr: …)" only its own parentheses.

#### setup

- **The claim** is a POST, cross-origin-checked like any other (`sign-in`), and it stores no
  address. It needs a valid bootstrap token and the browser's address (`sign-in`). Using up the
  token and creating the owner are one atomic step, and the owner session it starts follows
  `sign-in`'s cookies.
- **Security headers** (ground-floor choice 3) include a referrer policy of `same-origin` or
  `strict-origin-when-cross-origin`, never `no-referrer` (which makes browsers send `Origin: null`
  on the app's own form posts). Whether the app also sends strict transport security, and for how
  long, is for `setup`'s spec; if it does, only over HTTPS (known when `ORIGIN` is `https`, or when
  the browser sent `Sec-Fetch-Site` to a host that isn't loopback, since browsers send it only to
  HTTPS and loopback addresses).

#### sign-in

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
  that searches the code enforces, and redirects stay relative. (otpravkarr) This covers the
  subscribers' Plex sign-in as well as the owner's.
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
  a rebind, and those are gated by a console token or rate-limited.
- **Tests:** the cross-origin check is one pure module, unit-tested against a matrix of headers and
  copied to each app as D27 shares the opening modules. One Playwright test against the built server
  (`bun ./build`) checks that a cross-site form POST is refused and that a same-origin POST carrying
  no `Sec-Fetch-*` headers passes, both on `localhost` and on a plain-HTTP host name that isn't
  loopback (such as Chromium's `--host-resolver-rules="MAP app.test 127.0.0.1"`).
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

## Tech stack

The stack decisions are in [decisions.md](decisions.md) (D1–D12). Versions are exact pins in
`package.json` (Bun from its `packageManager` field) and `bun.lock`; Dependabot moves them. Every
package is a dev dependency, so adapter-bun bundles it and `bun ./build` needs no `node_modules`.

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
3. **Security headers and CSP.** The legacy app set a strict CSP and security headers (legacy spec
   §10). They belong to the first module that serves real pages (`setup`, whose claim page comes
   before `sign-in`), not the skeleton.
4. **Health.** `/healthz` always answers `ok`. The health module replaces it with legacy spec
   §6.12's public `ok`, `degraded` or `unhealthy`, from real Plex, Dispatcharr and database checks.

# Spec: otpravkarr

**Status:** the ground floor (skeleton) is specified here, approved by the orchestrator
(2026-10-18) and built. The capability map below is approved; no product module is specified yet.

## Objective

otpravkarr lets the accepted Plex friends of a server owner sign in with Plex and get their own
scoped IPTV account on the owner's Dispatcharr, through a subscriber portal and an owner console
([PRODUCT.md](../PRODUCT.md), [legacy spec](product/legacy-spec.md)).

**This spec covers only the ground floor:** an empty, production-shaped SvelteKit app that builds,
type-checks, tests, lints and serves on Bun, styled from the design tokens, with the edbfi Bun web
CI around it. It has no database, authentication, Plex, Dispatcharr or product features. Its job is
to make the first module spec cheap to build: every later PR adds behaviour, not plumbing.

## Capability map

**Status:** approved by the owner (2026-10-23). Module ids never change. Each module gets its own
`docs/SPEC-<id>.md`, which the owner approves just before it is built.
Sources: [PRODUCT.md](../PRODUCT.md), [decisions.md](decisions.md), the
[legacy spec](product/legacy-spec.md), the [Dispatcharr research](research/dispatcharr.md) and the
[surface briefs](../.impeccable/surfaces/).

**Every module keeps to [Code structure](../AGENTS.md#code-structure).** Its spec names the files it
adds in that layout, and review checks them. In short:
- The same role folders as every edbfi app. A folder exists only once it holds a real file.
- One purpose per file. No `utils`, `helpers`, `common` or `misc` files.
- Group by domain under the role folders. The folder says where; the file name says what.
- Imports only go downwards. Routes, hooks and jobs stay thin and call services.
- Tests sit next to their source.

| # | Module id | Responsibility | Depends on | Surfaces |
|---|---|---|---|---|
| 1 | `secrets` | Encrypts stored secrets (Plex token, Dispatcharr key, subscriber XC passwords) before they reach the database (D27) | — | — |
| 2 | `setup` | Startup checks, database and migrations, the bootstrap token, and claiming the instance for its one owner. Also adds the audit trail: its table and the one service every later change writes through | `secrets` | first-run setup (no brief yet) |
| 3 | `sign-in` | Owner sign-in with username and password, sessions, sign-out, rate limits, origin check and allowed origins (first entry: the origin the instance was claimed from, as legacy §6.1 pre-filled it), security headers and CSP, and the admin shell | `setup` | owner sign-in (no brief yet); the admin shell; the "Allowed website addresses" panel, which it builds first on `/admin/settings/lineup`; `lineup` adds its sections to that page later |
| 4 | `plex-connection` | Plex provider (D12, D18), SSRF-safe outbound HTTP (D8), and connecting, testing and saving the Plex server | `sign-in` | `/admin/settings/connections` (Plex form) |
| 5 | `dispatcharr-connection` | Dispatcharr provider with its service user (D25), version gate and contract tests (D26), and connecting, testing and saving the internal and public URLs and the key | `sign-in` | `/admin/settings/connections` (Dispatcharr form) |
| 6 | `health` | Plex, Dispatcharr and database checks on a timer, public `/healthz` (`ok`, `degraded`, `unhealthy`), the exposure item (D19) and the version warning (D26) | `plex-connection`, `dispatcharr-connection` | `/admin` (health tiles); `/healthz` |
| 7 | `lineup` | Lineup policies, core, fixed and approved groups, bundles, quarantine names, `hidden_from_output` (D24), content defaults (D22), and the offered and effective groups worked out from each person's choices | `dispatcharr-connection` | `/admin/settings/lineup` |
| 8 | `scoping` | Owned group profiles and the empty profile (`start_empty`, D23), the single enforcement path, event groups, and finding unsafe users (D23) | `dispatcharr-connection` | — |
| 9 | `accounts` | Subscriber records and their Streamer users (D21): create, disable by clearing `xc_password`, enable, remove permanently, rotate credentials, apply content flags (D22), and the ownership marker (D23) | `scoping` | — |
| 10 | `plex-sign-in` | Sign in with Plex. For friends: the accepted-friend check, the revoked view, the picker for new friends and provisioning on first sign-in. For the owner: linking their Plex account in the admin settings, after which Plex signs them in as the owner (D27) | `sign-in`, `plex-connection`, `lineup`, `accounts` | `/`; the owner's account settings (no brief yet) |
| 11 | `credentials` | The subscriber's XC URLs only (D19), reveal and copy, QR code on request, M3U snapshot, refreshing credentials, and the guide for free and open-source players | `plex-sign-in` | `/portal`, `/portal/setup` |
| 12 | `channel-choices` | Subscribers pick bundles or groups within policy, or see a locked view | `plex-sign-in`, `lineup` | `/portal/channels` |
| 13 | `subscriber-admin` | Users table with filters and drift, details, disable, enable, remove, rotate, changing groups and the lock, per-person content flags, and "Subscribe myself" | `accounts`, `lineup` | `/admin/users` |
| 14 | `sync` | The reconcile job: friend sync, adopting or removing managed users through the marker (D23), quarantine refresh, the subscription sync, plugin scope checks, the `m3u_refresh` webhook (D24), the interval setting and running it by hand | `accounts`, `lineup`, `plex-connection` | `/admin` (sync card); `/admin/settings/connections` (sync interval) |
| 15 | `audit-log` | The audit log page with filters, and the retention job (the writing comes with `setup`) | `sign-in` | audit log (no brief yet) |
| 16 | `plugin-advisories` | Read-only plugin cards: ECM scope, plugins that target owned profiles, and auto-sync groups without a scope (D24) | `scoping`, `lineup` | plugins (no brief yet) |
| 17 | `overview` | The owner dashboard: health, user counts, sync, recent activity, available friends | `health`, `accounts`, `sync`, `audit-log` | `/admin` |

Build order: `secrets` → `setup` → `sign-in` → `plex-connection`, `dispatcharr-connection` → `health`,
`lineup`, `scoping` → `accounts` → `plex-sign-in` → `credentials`, `channel-choices`,
`subscriber-admin`, `sync` → `audit-log`, `plugin-advisories` → `overview`. A comma means either
order works. `credentials` comes first in its group because it's the first time a friend gets
something they can use.

### Where modules live

Under `src/lib/server/` unless the path starts with `routes/`, in the [Code structure](../AGENTS.md#code-structure) layout:

| Module | Main homes |
|---|---|
| `secrets` | `security/secrets/`; loading the key in `config/` |
| `setup` | `db/` (client, migrations, settings, owner and audit schema), `config/`, `logging/`, `services/setup/`, `services/audit/record.ts`, `security/bootstrap-token.ts`; `routes/setup/`, and the setup gate in `hooks.server.ts` |
| `sign-in` | `services/sign-in/`, `security/` (sessions, rate limits, origin check, headers); `routes/(admin)/` layout, `lib/components/layout/` |
| `plex-connection` | `providers/plex/`, `http/`, `services/connections/plex.ts`; `routes/(admin)/admin/settings/connections/` |
| `dispatcharr-connection` | `providers/dispatcharr/`, `services/connections/dispatcharr.ts`; same route |
| `health` | `services/health/` (replaces `services/health.ts`), `jobs/health.ts` |
| `lineup` | `services/lineup/`, `db/` lineup schema; `routes/(admin)/admin/settings/lineup/` |
| `scoping` | `services/scoping/`, `db/` group-profile schema |
| `accounts` | `services/accounts/`, `db/` subscriber schema |
| `plex-sign-in` | `services/plex-sign-in/`; `routes/(public)/` and the Plex return route |
| `credentials` | `services/credentials/`; `routes/(app)/portal/`, `routes/(app)/portal/setup/` |
| `channel-choices` | `routes/(app)/portal/channels/` (uses `lineup` and `accounts`) |
| `subscriber-admin` | `routes/(admin)/admin/users/` (uses `accounts` and `lineup`) |
| `sync` | `services/sync/`, `jobs/sync.ts`; the webhook under `routes/api/` |
| `audit-log` | `services/audit/search.ts`, `jobs/audit-retention.ts`; `routes/(admin)/admin/audit/` |
| `plugin-advisories` | `services/plugins/`; `routes/(admin)/admin/plugins/` |
| `overview` | `routes/(admin)/admin/` |

### Open decisions each module closes

- `setup`: D15 (Drizzle and Turso pair) and the logging library half of D14. The secrets half of
  D16's backup and restore goes with `secrets`.
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
- Recognising the owner automatically as the Plex account behind the server token (legacy spec
  §6.2). The owner links their Plex account themselves, if they want to (D27, owner decision).

### Surfaces with no brief yet

First-run setup, owner sign-in, the owner's account settings, `/admin/plugins` and `/admin/audit`
are needed (the last two are in the legacy app and in PRODUCT.md's admin shell) but have no brief. Step 4 (`shape`) adds them before their modules are
specced.

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
- Tools run under Bun with `--bun`; a lifecycle script (`prepare`) calls each bin as
  `bun --bun <bin>`, because `bun ci` doesn't apply `--bun` to lifecycle scripts.
- Bun blocks `@parcel/watcher`'s install script (it builds with Node); Panda works without it.

## Commands

| Command | Does |
|---|---|
| `bun ci` | frozen install; `prepare` runs `svelte-kit sync` and Panda codegen |
| `bun run --bun dev` | Vite dev server |
| `bun run --bun build` | production build through adapter-bun into `build/` |
| `bun run --bun preview` | runs the built server (`bun ./build`; `PORT`, default 3000, and `HOST`) |
| `bun run --bun check` | `svelte-kit sync`, Panda codegen, then `svelte-check` failing on any error or warning |
| `bun run --bun test` | Vitest unit tests, once (no watch) |
| `bun run --bun smoke` | Playwright e2e smoke; it starts the built server, so `build` comes first, and Chromium comes from `bunx --bun playwright install chromium` |
| `bun run --bun lint` | `biome check` |
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

- **Unit (Vitest, `node` environment):** one test, for the `/healthz` handler: status 200, body
  `ok`, `cache-control: no-store`. Component tests use happy-dom when components exist; never jsdom.
- **e2e (Playwright, Chromium, under Bun):** one smoke test against the built adapter-bun server.
  It checks that `/` returns 200, shows the placeholder heading, hydrates (it waits for the
  `data-hydrated` attribute the root layout sets when mounted), applies the Panda background token
  and display text style and logs no console errors, and that `/healthz` returns `ok`.
- prek runs the unit tests (`tests` hook); CI's `smoke` job builds and runs the smoke test.

## CI and repo tooling

otpravkarr is a Bun web repo with edbfi-ci's Bun web templates:
- `.pre-commit-config.yaml`: Biome, `biome-migrate`, `check-peers`, the `tests` hook, plus a
  `check` hook (`bun run --bun check`), keeping the vendored-skill exclusions and the `docs-set`
  hook.
- `.github/workflows/ci.yml`: `checks` (prek), `smoke` (Chromium install, build, smoke) and `audit`
  (outside PRs); `checks` and `smoke` sit behind `ci-ok`, every job that installs runs with failing
  `node`, `npm` and `npx` on `PATH`, and the weekly run is `53 3 * * 0`.
- `.github/dependabot.yml` covers `github-actions`, `pre-commit` and `bun`, and
  `.github/workflows/biome-migrate.yml` applies Biome migrations to Dependabot's Biome PRs.

## Boundaries

- **Always:** Bun with `--bun` for every tool; tokens only through Panda; keep SvelteKit's
  configuration in the Vite plugin; prek green before each commit.
- **Ask first:** any dependency not in the tech stack table; any change to `biome.json` (it is
  shared by the five rewrite apps); any CI shape that differs from the edbfi-ci template.
- **Never:** a database, authentication, Plex, Dispatcharr or any product feature; a second styling
  tool or primitive library; Node, npm or npx anywhere, including CI.

## Success criteria

1. A fresh clone passes `bun ci`, `bun run --bun check` (zero errors and warnings), `bun run --bun
   test`, `bun run --bun build`, `bun run --bun smoke` and `prek run --all-files --hook-stage
   manual`, with no Node on `PATH`.
2. The built server (`bun ./build`) serves `/` with the placeholder page and `/healthz` with `ok`.
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
   §10). They belong to the first module that serves real pages (sign-in), not the skeleton.
4. **Health.** `/healthz` always answers `ok`. The health module replaces it with legacy spec
   §6.12's public `ok`, `degraded` or `unhealthy`, from real Plex, Dispatcharr and database checks.

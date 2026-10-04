# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

SvelteKit 3 / Svelte 5 app on Bun + `bun:sqlite` that provisions Plex friends as Dispatcharr IPTV users. Admin UI in `src/routes/(admin)`, end-user portal in `src/routes/(portal)`, JSON APIs in `src/routes/api`.

## Commands

Bun version is pinned by `packageManager` in `package.json`. The Vitest and Playwright CLIs run on Node.

- Install: `bun install --frozen-lockfile` (runs `svelte-kit sync` via `prepare`)
- Dev: `OTPRAVKARR_SECRET=$(openssl rand -base64 32) bun run dev`. Without a secret of 32+ bytes the server calls `process.exit(1)` on its first request
- Lint/format check: `bun run check`. This runs **Biome only**. To auto-fix: `bunx biome check --write .`
- Types: `bun run check:types` (sync + `tsc --noEmit` + `svelte-check --threshold warning`, so Svelte warnings fail CI)
- Unit tests: `bun run test`. For one file: `bun run test src/lib/server/__tests__/csrf.test.ts`. For one case, add `-t "<test name>"`
- Never use `bun test`: that is Bun's own runner, which can't compile Svelte and skips `vitest.config.ts`
- Production: `bun run build`, then `bun run start`, which runs `scripts/serve.ts` (see Deployment and origin)
- E2E, full as in CI: `bun run test:e2e` (`scripts/check-e2e.sh`: builds, diffs migrations, then runs two Playwright passes on fresh temp DBs)
- One E2E project, reusing an existing build: `E2E_SKIP_BUILD=1 bunx --no-install playwright test --project=app`. Project names are in `playwright.config.ts`. The fresh-setup spec needs `E2E_SEED_SETUP_PRE_ADMIN=1`

## Where `.agents/rules/svelte5-sveltekit-app.md` is wrong for this repo

That file is generic stack guidance. Its Svelte 5 runes, SSR-state and routing rules apply here. Where it conflicts with this repo, follow the repo:

| Topic | Rules file says | This repo (follow this) |
| --- | --- | --- |
| `$lib` | `#lib` subpath imports by default | An explicit `$lib` alias (`resolve.alias` in `vite.config.ts` plus tsconfig `paths`), the rule's second option. Keep using `$lib/…` |
| Dev runtime | dev may stay on Node | `bun --bun vite dev` too, because server code imports `bun:sqlite`, which Node cannot load |
| UnoCSS | `presetWind3` + `unocss-preset-shadcn/v3` | `presetWind4` + default `unocss-preset-shadcn` (`uno.config.ts`) |
| Component tests | `vitest-browser-svelte` browser mode | `@testing-library/svelte` + jsdom in the `components` Vitest project (`vitest.config.ts`) |
| Forms | Superforms 3 | Zod schemas in `src/lib/server/validation.ts`, `.safeParse` in actions, and `use:enhance`. No form library is installed |
| `check` script | svelte-check | Biome. Type checking is `check:types` |

## Boundaries

- `src/hooks.server.ts` is one `sequence(...)`. It runs lazy runtime init (env check, migrations, scheduler, bootstrap banner), the setup gate, session → `event.locals`, the Origin/CSRF check on mutating methods, and security headers. Until setup completes, every path not allowlisted in `setupGate` redirects to `/setup`. Add any new unauthenticated endpoint to that list.
- Server-only code lives in `src/lib/{db,dispatcharr,bridge,plex,scheduler,crypto,server}`. SvelteKit 3 guards files with a `server` name segment and any `server` directory outside `src/routes`, so it guards `$lib/server` but not the others; nothing stops those from being bundled for the client. Only a clean `bun run build` proves it (detection is off in Vitest). `.svelte` files may import only types from these modules, written as `import type`. Biome checks type-only imports in Svelte scripts, but a runtime value import can still drag `bun:sqlite` into the client. Send runtime data through `load`.
- Scheduled sync (`src/lib/scheduler/jobs/sync.ts`) and manual `POST /api/internal/sync` both call `runFullReconcile` in `src/lib/bridge/reconcile.ts` under the `plex-dispatcharr-sync` lock. Add new sync steps there, not in either caller.
- Environment: SvelteKit 3 exposes only the private variables declared in `src/env.ts`; an undeclared one silently reads as `undefined`. Read them through `$lib/server/private-env` and declare each new one (`src/__tests__/env.test.ts` fails otherwise). `scripts/serve.ts` sets `ORIGIN` (canonical) and `IDLE_TIMEOUT` (the effective idle window) in `process.env` before the app loads, so the declared values are the ones the front uses.
- Process-wide singletons (`db`, `scheduler`, rate limiters, bootstrap token) are deliberate because the app is a single process. Per-request data goes in `event.locals`.

## Auth guards

| Where | Call | On failure |
| --- | --- | --- |
| `(admin)` `+page.server.ts`: `load` **and every action** | `requireAdmin(event)` | 303 → `/login` |
| `src/routes/api/internal/**/+server.ts` | `requireAdminApi(event)` | 401/403 JSON |
| Portal routes that serve credentials | `requireUser(event)` (rejects inactive users) | 303 → `/` |

The `(admin)` layout's `load` does not protect actions. Every existing admin action calls `requireAdmin` itself. All guards are in `src/lib/server/auth.ts`.

## Dispatcharr client

| Caller | Factory (`src/lib/dispatcharr/client.ts`) |
| --- | --- |
| Page `load` or connection test, which must render before the server closes the idle connection (`IDLE_TIMEOUT`, 10s default; `scripts/serve.ts` keeps it equal to the effective `CONNECTION_IDLE_TIMEOUT`) | `createInteractiveClient`: short timeout, no retry. Wrap multi-call loads in `withDeadline` (`src/lib/utils/deadline.ts`) |
| Background jobs, bridge, provisioning, mutations, credential serving | `createRobustClient` or `new DispatcharrClient`: 15s timeout, retries idempotent GETs |

Endpoints in `src/lib/dispatcharr/endpoints/` never throw. They return `DispatcharrResult<T>`, and callers branch on `.ok`. Responses are validated with Zod schemas from `schemas.ts`. List endpoints use `fetchAllPages`. Example from `src/lib/dispatcharr/endpoints/profiles.ts`:

```ts
export function getProfile(
  client: DispatcharrClient,
  id: number,
): Promise<DispatcharrResult<DispatcharrChannelProfileWithChannels>> {
  return client.request("GET", `/api/channels/profiles/${id}/`, {
    schema: DispatcharrChannelProfileWithChannelsSchema,
  });
}
```

## Database and secrets

Raw SQL lives in `src/lib/db/repositories/*`. Row types are hand-mirrored in `src/lib/db/types.ts`. To change the schema:

1. Add `src/lib/db/migrations/NNN_name.sql` with the next number. Never edit an applied migration: the runner tracks versions only, so edits are silently skipped on existing DBs.
2. Update `src/lib/db/types.ts` and the repository.
3. Update that repository's test, which uses a hand-written `bun:sqlite` mock (see Testing).
4. If the change adds an encrypted column, add it to `scripts/rotate-key.ts`. That script re-encrypts only `config` rows with `encrypted = 1` and `user_mappings.dispatcharr_xc_password_enc`.

- Store secrets with `setConfig(key, value, true)`. Without `true`, the value is stored as cleartext.
- The HKDF salt, purpose strings and IV-prefixed AES-GCM format appear in three places: `src/lib/crypto/{keys,encryption}.ts`, `scripts/rotate-key.ts` and `e2e/seed-db.ts`. Change all three together.
- `e2e/seed-db.ts` itself applies only `001_initial.sql`; later migrations run when the server starts. Seeded rows must fit the 001 schema.

## Testing

- `vitest.config.ts` uses the plain `svelte()` plugin, not `sveltekit()`, and defines two projects. `components` runs `src/lib/components/**/*.test.ts` and `src/routes/**/*.svelte.test.ts` with the `@testing-library/svelte` plugin. `server` runs every other test plus `vite.config.test.ts`, without that plugin, so server code under test gets SvelteKit's server exports. Never render a component in a `server` test. Run one project with `bunx vitest run --project components` (or `server`).
- Only `$lib` and `$app/{forms,navigation,state}` resolve (to `src/lib/test-stubs/`). `$app/env`, `$lib/server/private-env` (the one module that reads SvelteKit's private env) and `bun:sqlite` must be `vi.mock`ed in each test that reaches them. Tests run on Node, so a test that needs `Bun.*` stubs it with `vi.stubGlobal("Bun", …)`.
- The default environment is jsdom. Server-side tests begin with `// @vitest-environment node`.
- `scripts/serve.test.ts` (server project) spawns real Bun processes running `scripts/serve.ts` against a stand-in adapter (`scripts/fixtures/standin-adapter.js`), so `bun` must be on `PATH` when Vitest runs.
- DB repository tests run SQL against mocks. Real SQLite runs only in E2E.
- Library tests go in `__tests__/` beside the module. Route tests sit next to the route as `page.server.test.ts`, `page.svelte.test.ts` or `server.test.ts`, without the `+` prefix. `tsconfig.json` excludes `src/**/__tests__/**`, so `check:types` skips those files.
- Canonical server test shape (`src/routes/(admin)/plugins/page.server.test.ts`):

```ts
// @vitest-environment node
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ id: 1, username: "admin" })),
  getConfig: vi.fn(async (_key: string) => null as string | null),
}));
vi.mock("$lib/server/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("$lib/db/repositories/config", () => ({ getConfig: mocks.getConfig }));
// …then inside a test: const { load } = await import("./+page.server");
```

## UI

- The CSP (`sveltekit({ csp })` in `vite.config.ts`) sets `style-src 'self'`. Don't add inline `style="…"` attributes or `style:` directives. Instead, use UnoCSS classes or data-attribute rules in a component `<style>` block (see `src/lib/components/ui/sidebar/sidebar-menu-skeleton.svelte`). New image or API hosts must be added to `img-src` and `connect-src`.
- Import `cn` from `$lib/utils.js` (`src/lib/utils.ts`). `src/lib/utils/cn.ts` is an unused duplicate.
- A new admin page needs `src/routes/(admin)/<name>/+page.server.ts` + `+page.svelte`, and a `navItems` entry in `src/lib/components/AdminSidebar.svelte`.

## Deployment and origin

- `@sveltejs/adapter-bun` builds the server (`bun --bun vite build`; keep `--bun`). `scripts/serve.ts` is the production entry (`start`, Playwright, the container image).
- `ORIGIN` is the one public-origin setting: the address people open in the browser. **Plain-HTTP deployments must set it**; leave it unset only behind an HTTPS reverse proxy that passes the original `Host`. Without it, `scripts/serve.ts` loads `build/index.js`, the adapter listens on `HOST`/`PORT` and derives the origin as `https` + `Host`, so plain-HTTP sign-in and writes get 403; startup logs the shared warning once when neither `ORIGIN` nor `PROTOCOL_HEADER` is set.
- `scripts/serve.ts` parses `ORIGIN` as every edbfi front does (`parseOrigin`): trimmed (blank means unset), any case, default port and one trailing `/` allowed; a path, query, fragment or credentials exit 1 before binding with one sentence that never echoes the value. It writes the canonical `url.origin` back to `process.env.ORIGIN` before the app loads, so app code compares the same string.
- With `ORIGIN` it fronts the adapter: it binds `HOST`/`PORT`, runs the adapter on a private Unix socket, forwards the raw path (`forwardPath`, never `new URL(request.url)`), and overwrites `x-otpravkarr-origin-proto`/`-host`/`-peer` on every request. The origin never comes from the request's `Host` header. Keep that file small and tested (`scripts/serve.test.ts`); obzorarr and setun copy its pattern.
- App-level origin settings derive from `ORIGIN`: the CSRF hook and the settings lockout guard use `effectiveAllowedOrigins` (`src/lib/server/origins.ts`), which always includes `ORIGIN`; the stored `allowed_origins` only add origins.
- Behind a reverse proxy, `ADDRESS_HEADER=x-forwarded-for` (with `XFF_DEPTH` = the number of proxies, default 1) only when every request goes through it; `PROTOCOL_HEADER`/`HOST_HEADER` only without `ORIGIN`, behind a trusted proxy.
- `IDLE_TIMEOUT` maps to the adapter's `CONNECTION_IDLE_TIMEOUT` (an explicit `CONNECTION_IDLE_TIMEOUT` wins). With `ORIGIN`, the front applies that window to the client only: its timer is off from the end of the request body until the app answers, then re-armed (Bun 1.4.2 otherwise closes a request still waiting on the app). `SHUTDOWN_TIMEOUT` (default 30 s) bounds the drain of both the adapter and the front; a second signal exits 1, and the front removes its socket directory on every exit. `BODY_SIZE_LIMIT` (default `512K`) is enforced by the adapter.
- Cookies are `Secure` only when `event.url` is `https:` (`isSecureRequest` and the option helpers in `src/lib/server/auth.ts`). Pass that `secure` value to every `cookies.set` and `cookies.delete`; a plain-HTTP origin cannot keep a `Secure` cookie.

## Commits

`prek.toml` runs `biome check --write` and the full `check:types` on pre-commit, and enforces Conventional Commits on commit-msg. It also blocks commits to `main` (`no-commit-to-branch`). These hooks are active only after `prek install`.

## Reference

- `.agents/rules/svelte5-sveltekit-app.md`: Svelte 5 runes, SSR state safety, load/actions conventions. Read before writing components or routes, and apply the conflict table above.
- `README.md`: env vars, production startup, health API contract. Read when changing env handling, startup, or `/api/health`.

## Biome configuration

Biome is pinned to 2.5.13. The configuration uses Git ignores, the recommended lint and assist presets, and experimental full Svelte support. Keep type checking separate from Biome. Project quote, comma and indentation conventions remain explicit in the configuration.

The exact-file formatter overrides protect components containing `{@const ...}`: Biome 2.5.14 inserts parentheses that Svelte rejects with `expected_pattern`. These files still receive lint and import checks. Recheck them with the Svelte compiler when upgrading Biome before removing the exceptions. Do not run a formatter with these overrides bypassed.

Inline accessibility suppressions cover href forwarded through polymorphic props, named link groups and the native search form. They do not disable accessibility checks across all Svelte files.

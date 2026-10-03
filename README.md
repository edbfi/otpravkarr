<p align="center">
  <img src="static/otpravkarr-icon.svg" alt="Otpravkarr Logo" width="256" height="256">
</p>

<h1 align="center">Otpravkarr</h1>

<p align="center">
  <strong>Plex user provisioning and per-user IPTV access for Dispatcharr</strong>
</p>

<p align="center">
  <a href="https://github.com/edbfi/otpravkarr/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/bun-%23000000.svg?logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/SvelteKit-FF3E00?logo=svelte&logoColor=white" alt="SvelteKit">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite">
</p>

## Prerequisites

- [Bun](https://bun.sh), using the version pinned by `packageManager` in `package.json` (also used by CI and container builds)
- Docker (optional, for production)

## Quick Start

```bash
bun install --frozen-lockfile
# Generate once, then save and reuse this secret outside version control.
export OTPRAVKARR_SECRET=$(openssl rand -base64 32)
bun run dev
```

The dev server binds to `PORT` (default `3000`) and fails fast if that port is busy. With defaults it starts at `http://localhost:3000`. A bootstrap token will appear in the console — use it to complete the setup wizard.

## Production Startup

Use `bun run build`, then `bun run start` with the same pinned Bun version.
The start script sets `NODE_ENV=production` and runs `scripts/serve.ts`, which
starts the `@sveltejs/adapter-bun` server in `build/`. Ship `scripts/serve.ts`
with production `node_modules/`, `package.json` and the complete `build/`
directory; `build/server/migrations/` contains the SQL copied by the build
command.
Keep the same `OTPRAVKARR_SECRET` and database across restarts. A configured
`DATABASE_PATH` must point to an existing database; the production guard refuses
to create a replacement if that path is missing.

### Public origin (`ORIGIN`)

SvelteKit 3 checks the origin of every form post. Without `ORIGIN`, the server
assumes it sits behind an HTTPS proxy that preserves the `Host` header and
takes the origin as `https://<Host>`; plain-HTTP form posts and writes are then
rejected with 403, and startup logs a warning when neither `ORIGIN` nor
`PROTOCOL_HEADER` is set.

**When you serve plain HTTP, set `ORIGIN` to the public URL** (for example
`http://192.168.1.10:3000`). `scripts/serve.ts` then listens on `HOST`/`PORT`
itself, runs the app on a private Unix socket and passes the configured origin
to it on every request. `ORIGIN` must be a bare origin: no path, query,
credentials or default port. The origin is never taken from the request's
`Host` header. Leave `ORIGIN` unset only behind a TLS-terminating proxy that
preserves `Host` (or set `PROTOCOL_HEADER` for a trusted proxy that sends it).
Cookies are marked `Secure` only when the public origin is `https`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OTPRAVKARR_SECRET` | **Yes** | — | Master encryption secret (>= 32 random bytes, base64) |
| `DATABASE_PATH` | No | `./data/otpravkarr.sqlite` | SQLite database file path |
| `HOST` | No | `0.0.0.0` | Listen address |
| `PORT` | No | `3000` | Listen port |
| `ORIGIN` | No | unset | Public URL, for example `http://192.168.1.10:3000`. Required when serving plain HTTP; see [Public origin](#public-origin-origin). After setup, the app's own origin check uses the allowed origins saved by the setup wizard |
| `IDLE_TIMEOUT` | No | `10` | Seconds before an idle client connection closes (0–255; `0` disables). Mapped to the adapter's `CONNECTION_IDLE_TIMEOUT`, which wins if both are set. Event streams are exempt |
| `SHUTDOWN_TIMEOUT` | No | `30` | Seconds to drain in-flight requests on `SIGTERM`/`SIGINT` before closing them |
| `BODY_SIZE_LIMIT` | No | `512K` | Maximum request body (`K`/`M`/`G` suffixes, `Infinity` to disable) |
| `PROTOCOL_HEADER` | No | unset | Only behind a trusted proxy and without `ORIGIN`: header carrying `http`/`https` (for example `x-forwarded-proto`). With `ORIGIN` set the app supplies it itself |
| `ADDRESS_HEADER`, `XFF_DEPTH` | No | unset, `1` | Only behind a trusted proxy that clients cannot bypass: header with the client address (for example `x-forwarded-for`, counted `XFF_DEPTH` hops from the right). Used for rate limiting; without it the TCP peer is used |

## Docker Deployment

Container packaging is maintained separately in
[`edbfi/otpravkarr-docker`](https://github.com/edbfi/otpravkarr-docker). This application
repository intentionally has no Dockerfile or Docker build context.

```yaml
services:
  otpravkarr:
    image: ghcr.io/edbfi/otpravkarr-docker:nightly
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
    environment:
      - NODE_ENV=production
      - OTPRAVKARR_SECRET=<your-secret>
      - ORIGIN=https://otpravkarr.example.com
    restart: unless-stopped
```

Generate a secret: `openssl rand -base64 32`

## First-Run Setup

1. Start the container — a one-time **bootstrap token** and setup URL appear in the logs
2. Visit the setup URL and manually enter the token
3. Complete the setup wizard (Plex + Dispatcharr credentials)

Complete the wizard immediately; the bootstrap token is single-use.

## Production Checklist

- [ ] Strong `OTPRAVKARR_SECRET` (>= 32 random bytes, base64-encoded)
- [ ] Plain HTTP: `ORIGIN` set to the public URL. HTTPS proxy: `ORIGIN` set to the public URL, or unset if the proxy preserves `Host`
- [ ] Persistent volume mounted for `./data` (SQLite lives here)
- [ ] Behind a reverse proxy: it appends `X-Forwarded-For`, clients cannot reach the app directly, and `ADDRESS_HEADER=x-forwarded-for` is set (rate limiting keys on the client address)
- [ ] With `ORIGIN` set, do not set `PROTOCOL_HEADER`/`HOST_HEADER`; the app supplies them. Without `ORIGIN`, set `PROTOCOL_HEADER` only for a proxy you control
- [ ] Verify bootstrap token appears in container logs on first run
- [ ] Complete setup wizard immediately after first start

## API

**`GET /api/health`** — Returns coarse application health status (unauthenticated). The `status` field is one of `"ok"`, `"degraded"`, or `"unhealthy"`.

```json
{
  "status": "ok"
}
```

**`GET /api/internal/health`** — Returns the full health payload (admin session required). The top-level `status` is one of `"ok"`, `"degraded"`, or `"unhealthy"`; `checks.dispatcharr.status` is `"connected"` or `"disconnected"`.

```json
{
  "status": "ok",
  "checks": {
    "plex": { "status": "healthy", "lastChecked": "2026-01-01T00:00:00.000Z" },
    "dispatcharr": { "status": "connected", "reachable": true, "authValid": true, "lastChecked": "2026-01-01T00:00:00.000Z" },
    "database": { "status": "healthy", "lastChecked": "2026-01-01T00:00:00.000Z" }
  },
  "uptime": 3600,
  "version": "0.0.1"
}
```

## License

[AGPL-3.0](LICENSE)

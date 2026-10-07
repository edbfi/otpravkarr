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

**Set `ORIGIN` to the address people open in the browser**, for example
`http://192.168.1.10:3000`. It is required when you serve plain HTTP. Leave it
unset only behind an HTTPS reverse proxy that passes the original `Host`
header: without `ORIGIN` the server takes the origin to be `https://<Host>`, so
over plain HTTP signing in and saving changes fail (SvelteKit rejects the form
posts with 403). Startup logs a warning when neither `ORIGIN` nor
`PROTOCOL_HEADER` is set.

With `ORIGIN` set, `scripts/serve.ts` listens on `HOST`/`PORT` itself, runs the
app on a private Unix socket and passes the configured origin to it on every
request; the origin is never taken from the request's `Host` header.
Surrounding spaces, letter case, a default port and a trailing `/` are
normalised (`HTTP://Example.com:80/` means `http://example.com`). A path,
query, fragment or credentials stop startup with an error that does not repeat
the value. The app's own origin check always allows `ORIGIN`; the allowed
origins saved in the setup wizard or in Settings add origins to it and never
replace it, so changing `ORIGIN` later cannot lock you out. Cookies are marked
`Secure` only when the public origin is `https`.

Behind a reverse proxy, set `ADDRESS_HEADER=x-forwarded-for` (and `XFF_DEPTH`
to the number of proxies, default 1) only when every request goes through the
proxy: the app then rate-limits on the client address the proxy appended.
Set `PROTOCOL_HEADER`/`HOST_HEADER` only without `ORIGIN`, for a trusted proxy
that sends them; with `ORIGIN` the app supplies them itself.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OTPRAVKARR_SECRET` | **Yes** | — | Master encryption secret (>= 32 random bytes, base64) |
| `DATABASE_PATH` | No | `./data/otpravkarr.sqlite` | SQLite database file path |
| `HOST` | No | `0.0.0.0` | Listen address |
| `PORT` | No | `3000` | Listen port |
| `ORIGIN` | Plain HTTP: **yes** | unset | The address people open in the browser, for example `http://192.168.1.10:3000`. Leave unset only behind an HTTPS reverse proxy that passes the original `Host`; see [Public origin](#public-origin-origin). Always allowed by the app's origin check; saved allowed origins add to it |
| `IDLE_TIMEOUT` | No | `10` | Seconds before an idle client connection closes (0–255; `0` disables). Mapped to the adapter's `CONNECTION_IDLE_TIMEOUT`, which wins if both are set. Event streams are exempt |
| `SHUTDOWN_TIMEOUT` | No | `30` | Seconds to drain in-flight requests on `SIGTERM`/`SIGINT` before closing them; with `ORIGIN` set, also on `SIGHUP` (closing the terminal), and the process exits at that deadline even if the app still has work in flight. A second `SIGTERM`/`SIGINT` exits at once; a repeated `SIGHUP` does not |
| `BODY_SIZE_LIMIT` | No | `512K` | Maximum request body (`K`/`M`/`G` suffixes, `Infinity` to disable) |
| `ADDRESS_HEADER`, `XFF_DEPTH` | No | unset, `1` | Behind a reverse proxy, only when every request goes through it: `ADDRESS_HEADER=x-forwarded-for`, with `XFF_DEPTH` the number of proxies (the client address is read that many hops from the right). Used for rate limiting; without it the TCP peer is used |
| `PROTOCOL_HEADER`, `HOST_HEADER` | No | unset | Only without `ORIGIN`, behind a trusted proxy: the headers carrying the public scheme (`http`/`https`, for example `x-forwarded-proto`) and host. With `ORIGIN` set the app supplies them itself |

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
      - ORIGIN=http://192.168.1.10:3000 # the address people open in the browser
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
- [ ] `ORIGIN` set to the address people open in the browser (required for plain HTTP); unset only behind an HTTPS reverse proxy that passes the original `Host`
- [ ] Persistent volume mounted for `./data` (SQLite lives here)
- [ ] Behind a reverse proxy that every request goes through: `ADDRESS_HEADER=x-forwarded-for`, and `XFF_DEPTH` set to the number of proxies if more than one (rate limiting keys on the client address)
- [ ] With `ORIGIN` set, do not set `PROTOCOL_HEADER`/`HOST_HEADER`; the app supplies them. Without `ORIGIN`, set them only for a proxy you control
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

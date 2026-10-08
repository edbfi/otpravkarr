// Production smoke test (`bun run smoke`, after `bun run build`): starts the production entry,
// `scripts/serve.ts`, on a fresh empty database and checks that it migrates, reports its health
// and sends a first visitor to the setup wizard, then that SIGTERM stops it cleanly.
//
// It runs the direct path (no ORIGIN, so the adapter listens on HOST/PORT itself); the E2E suite
// (`bun run test:e2e`) runs the ORIGIN front.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "30000");
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error(`Invalid SMOKE_TIMEOUT_MS: ${process.env.SMOKE_TIMEOUT_MS}`);
}
const shutdownTimeoutMs = 10_000;

// Reserve a free port (or check PORT is free), then release it for the server.
const requestedPort = Number(process.env.PORT ?? "0");
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65_535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}
let reservation: ReturnType<typeof Bun.serve>;
try {
  reservation = Bun.serve({
    hostname: "127.0.0.1",
    port: requestedPort,
    fetch: () => new Response(null, { status: 503 }),
  });
} catch (cause) {
  throw new Error(`Smoke-test port ${requestedPort} is already in use`, { cause });
}
const port = reservation.port;
await reservation.stop(true);
const base = `http://127.0.0.1:${port}`;

// The production guard refuses a missing DATABASE_PATH, so start from an empty database file.
const directory = mkdtempSync(join(tmpdir(), "otpravkarr-smoke-"));
const databasePath = join(directory, "smoke.sqlite");
writeFileSync(databasePath, "");

const env: Record<string, string | undefined> = {
  ...process.env,
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  PORT: String(port),
  DATABASE_PATH: databasePath,
  // A throwaway key for this disposable database, never stored.
  OTPRAVKARR_SECRET: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"),
};
// Drop every other variable adapter-bun reads (DEVELOPMENT, for one, turns on development mode),
// so the smoke tests the production defaults whatever the caller's shell sets.
for (const name of [
  "ORIGIN",
  "SOCKET_PATH",
  "REUSE_PORT",
  "IPV6_ONLY",
  "CONNECTION_IDLE_TIMEOUT",
  "BODY_SIZE_LIMIT",
  "SHUTDOWN_TIMEOUT",
  "DEVELOPMENT",
  "XFF_DEPTH",
  "ADDRESS_HEADER",
  "PROTOCOL_HEADER",
  "HOST_HEADER",
  "PORT_HEADER",
]) {
  delete env[name];
}

// --no-env-file: a developer's .env (ORIGIN, DATABASE_PATH) must not change what is tested.
const server = Bun.spawn(["bun", "--no-env-file", "./scripts/serve.ts"], {
  env,
  stdout: "pipe",
  stderr: "pipe",
});
const stdout = new Response(server.stdout).text();
const stderr = new Response(server.stderr).text();

async function get(path: string): Promise<Response> {
  return await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
}

async function waitForHealth(): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline && server.exitCode === null) {
    try {
      const response = await get("/api/health");
      // Only a response while the spawned server is still running counts: anything else on the
      // port is not the server under test.
      if (response.status === 200 && server.exitCode === null) {
        const body = (await response.json()) as { status?: unknown };
        return String(body.status);
      }
      lastError = `HTTP ${response.status}`;
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : String(cause);
    }
    await Bun.sleep(250);
  }
  throw new Error(
    server.exitCode === null
      ? `/api/health did not answer 200 within ${timeoutMs}ms (${lastError})`
      : `server exited with status ${server.exitCode} before it was ready`,
  );
}

function assertRunning(): void {
  if (server.exitCode !== null) {
    throw new Error(`server exited with status ${server.exitCode} during the checks`);
  }
}

async function checks(): Promise<void> {
  // An empty database has no Plex or Dispatcharr configured: "degraded"; "unhealthy" means the
  // database itself failed.
  const health = await waitForHealth();
  if (health !== "ok" && health !== "degraded") {
    throw new Error(`/api/health reported ${JSON.stringify(health)}, expected ok or degraded`);
  }

  assertRunning();
  const root = await get("/");
  const location = root.headers.get("location");
  if (root.status !== 303 || location !== "/setup") {
    throw new Error(`/ answered ${root.status} to ${location}, expected 303 to /setup`);
  }

  const setup = await get("/setup");
  const html = await setup.text();
  if (setup.status !== 200 || !setup.headers.get("content-type")?.includes("text/html")) {
    throw new Error(`/setup answered ${setup.status} ${setup.headers.get("content-type")}`);
  }
  if (!html.includes("<title>Setup — otpravkarr</title>")) {
    throw new Error("/setup does not have the setup wizard title");
  }
  // The responses above came from the spawned server only if it is still running now.
  assertRunning();
  console.log(`/api/health ${health}; / -> /setup (303); /setup title ok`);
}

async function stop(): Promise<number | null> {
  if (server.exitCode !== null) return server.exitCode;
  server.kill("SIGTERM");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const exited = await Promise.race([
    server.exited.then(() => true),
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), shutdownTimeoutMs);
    }),
  ]);
  clearTimeout(timer);
  if (exited) return server.exitCode;
  server.kill("SIGKILL");
  await server.exited;
  return null;
}

let failure: unknown;
let exitCode: number | null = null;
try {
  await checks();
} catch (error) {
  failure = error;
} finally {
  exitCode = await stop();
  rmSync(directory, { recursive: true, force: true });
}

if (failure === undefined && exitCode !== 0) {
  failure = new Error(
    exitCode === null
      ? `server did not stop within ${shutdownTimeoutMs}ms of SIGTERM`
      : `server exited with status ${exitCode} after SIGTERM, expected 0`,
  );
}
if (failure !== undefined) {
  const [out, err] = await Promise.all([stdout, stderr]);
  // The first-run banner's bootstrap token is useless once the server is gone; keep it out of logs.
  const redact = (text: string) => text.replace(/(Bootstrap token: ).*/g, "$1[redacted]");
  if (out) console.error(redact(out));
  if (err) console.error(redact(err));
  console.error(`Smoke test failed: ${failure instanceof Error ? failure.message : failure}`);
  process.exit(1);
}
console.log(`Smoke test passed on port ${port}; server stopped cleanly on SIGTERM`);

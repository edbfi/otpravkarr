// Production entry (`bun scripts/serve.ts`). SvelteKit 3 adapters no longer read a runtime
// ORIGIN, so when the operator sets one, this listener fronts the adapter over a private Unix
// socket and supplies the configured origin through headers only it can set. Without ORIGIN the
// adapter listens directly on HOST/PORT and derives the origin as https + Host.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Environment = Record<string, string | undefined>;

export const PROTOCOL_HEADER = "x-otpravkarr-origin-proto";
export const HOST_HEADER = "x-otpravkarr-origin-host";
export const PEER_HEADER = "x-otpravkarr-peer";

// Worded the same in every edbfi app: it names what fails for the user and how to fix it.
export const MISSING_ORIGIN_WARNING =
  "ORIGIN is not set: Otpravkarr assumes it is served over HTTPS behind a proxy that preserves " +
  "the Host header. Over plain HTTP, signing in and saving changes will fail. Set ORIGIN to the " +
  "address users open, for example ORIGIN=http://192.168.1.10:3000.";

export const ORIGIN_ERROR =
  "ORIGIN must be a bare http(s) origin such as http://192.168.1.10:3000 (no path, query, " +
  "fragment or credentials).";

/**
 * Parses ORIGIN as every edbfi front does: surrounding whitespace is ignored, so is an uppercase
 * scheme or host, a default port and one trailing `/`; a path, query, fragment, credentials or a
 * non-http(s) scheme is a startup error. Returns the canonical origin (`url.origin`: lowercase
 * scheme and host, no default port, IDN as punycode), or undefined when the value is empty. The
 * error never echoes the value, which may carry credentials, and never wraps the URL parser's
 * error (it keeps the raw input).
 */
export function parseOrigin(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  let url: URL | undefined;
  try {
    url = new URL(trimmed);
  } catch {
    // fall through to the redacted error below
  }
  if (
    !url ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    // An empty query or fragment leaves no trace on the parsed URL, so check the value itself.
    /[?#]/.test(trimmed)
  ) {
    throw new Error(ORIGIN_ERROR);
  }
  return url.origin;
}

function integer(name: string, value: string, max: number): number {
  if (!/^\d+$/.test(value) || Number(value) > max) {
    throw new Error(`${name} must be an integer between 0 and ${max}.`);
  }
  return Number(value);
}

/** The adapter's SHUTDOWN_TIMEOUT, parsed as adapter-bun parses it (default 30 s). */
export function shutdownTimeoutSeconds(environment: Environment): number {
  const value = environment.SHUTDOWN_TIMEOUT;
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : 30;
}

/**
 * Wraps an event-stream body so that it ends normally when the adapter breaks it off. At the
 * end of its shutdown drain the adapter force-closes the streams still open; passed through as
 * is, that failure reaches the client as a broken connection (a browser reports a reset), while
 * a normal end lets EventSource reconnect as after any end of stream. A client that goes away
 * still cancels the upstream. Only event streams get this: any other body must still fail
 * visibly, so a truncated download is never mistaken for a complete one.
 */
export function endQuietly(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch {
        controller.close();
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/**
 * The path and query of a request exactly as the client sent them, sliced from the URL string
 * after any authority. `new URL(request.url)` would throw when the client's Host header is not a
 * valid host (Bun then gives a bare path or an unparsable URL), and would re-serialise the path.
 */
export function forwardPath(requestUrl: string): string {
  const scheme = requestUrl.indexOf("://");
  const start = scheme === -1 ? 0 : requestUrl.indexOf("/", scheme + 3);
  return start === -1 ? "/" : requestUrl.slice(start);
}

export type Plan =
  | { mode: "direct"; warning: string | null }
  | {
      mode: "front";
      origin: URL;
      hostname: string;
      port: number;
      idleTimeout: number | undefined;
      ownPeerHeader: boolean;
      directory: string;
      socket: string;
    };

/**
 * Prepares the environment the adapter reads and returns how to start. Mutates `environment`.
 */
export function prepare(environment: Environment): Plan {
  // adapter-bun renamed IDLE_TIMEOUT; keep the documented variable working. An explicit
  // CONNECTION_IDLE_TIMEOUT wins.
  if (environment.IDLE_TIMEOUT) environment.CONNECTION_IDLE_TIMEOUT ??= environment.IDLE_TIMEOUT;
  // The Dispatcharr client (src/lib/dispatcharr/client.ts) keeps interactive requests below
  // IDLE_TIMEOUT, so IDLE_TIMEOUT always names the effective client-facing idle window.
  if (environment.CONNECTION_IDLE_TIMEOUT) {
    environment.IDLE_TIMEOUT = environment.CONNECTION_IDLE_TIMEOUT;
  }

  const canonical = parseOrigin(environment.ORIGIN ?? "");
  if (canonical === undefined) {
    // Empty means unset, for the app too. The origin is never derived from the request's Host
    // header here (DNS rebinding).
    delete environment.ORIGIN;
    const warning = environment.PROTOCOL_HEADER ? null : MISSING_ORIGIN_WARNING;
    return { mode: "direct", warning };
  }
  // The app (CSRF allowlist, bootstrap banner) reads ORIGIN too: give it the same canonical
  // string the front sends, before the adapter loads.
  environment.ORIGIN = canonical;
  const origin = new URL(canonical);
  const hostname = environment.HOST || "0.0.0.0";
  const port = integer("PORT", environment.PORT || "3000", 65535);
  const idle = environment.CONNECTION_IDLE_TIMEOUT;
  const idleTimeout = idle ? integer("CONNECTION_IDLE_TIMEOUT", idle, 255) : undefined;

  const directory = mkdtempSync(join(tmpdir(), "otpravkarr-"));
  const socket = join(directory, "app.sock");
  environment.SOCKET_PATH = socket;
  // The front overwrites these headers on every request, so clients cannot forge them.
  environment.PROTOCOL_HEADER = PROTOCOL_HEADER;
  environment.HOST_HEADER = HOST_HEADER;
  delete environment.PORT_HEADER;
  // An operator-configured address header (e.g. x-forwarded-for behind a trusted proxy)
  // passes through unchanged; otherwise the front reports the TCP peer itself.
  const ownPeerHeader = !environment.ADDRESS_HEADER;
  if (ownPeerHeader) environment.ADDRESS_HEADER = PEER_HEADER;
  // Over a Unix socket the adapter's event-stream idle exemption does not work (Bun 1.4.2), so
  // the adapter side never times out and the public listener enforces the client idle timeout.
  environment.CONNECTION_IDLE_TIMEOUT = "0";

  return { mode: "front", origin, hostname, port, idleTimeout, ownPeerHeader, directory, socket };
}

export async function serve(
  environment: Environment = process.env,
  importServer: () => Promise<unknown> = () =>
    import(pathToFileURL(resolve("build/index.js")).href),
): Promise<void> {
  const plan = prepare(environment);
  if (plan.mode === "direct") {
    if (plan.warning) console.warn(plan.warning);
    await importServer();
    return;
  }

  const { origin, ownPeerHeader, directory, socket } = plan;
  const removeSocketDirectory = () => rmSync(directory, { recursive: true, force: true });
  let markReady = () => {};
  const ready = new Promise<void>((resolveReady) => {
    markReady = resolveReady;
  });

  // Bind the public port before loading the adapter, so a busy port never starts the app;
  // requests that arrive while the adapter loads wait for it.
  let listener: ReturnType<typeof Bun.serve>;
  try {
    listener = Bun.serve({
      hostname: plan.hostname,
      port: plan.port,
      ...(plan.idleTimeout === undefined ? {} : { idleTimeout: plan.idleTimeout }),
      // BODY_SIZE_LIMIT is enforced by the adapter behind the socket.
      maxRequestBodySize: Number.MAX_SAFE_INTEGER,
      async fetch(request, server) {
        await ready;
        const headers = new Headers(request.headers);
        headers.set(PROTOCOL_HEADER, origin.protocol.slice(0, -1));
        headers.set(HOST_HEADER, origin.host);
        if (ownPeerHeader) headers.set(PEER_HEADER, server.requestIP(request)?.address ?? "");
        else headers.delete(PEER_HEADER);
        let response: Response;
        try {
          response = await fetch(`http://localhost${forwardPath(request.url)}`, {
            method: request.method,
            headers,
            body: request.method === "GET" || request.method === "HEAD" ? null : request.body,
            redirect: "manual",
            decompress: false,
            signal: request.signal,
            unix: socket,
          });
        } catch {
          return new Response("Service Unavailable", { status: 503 });
        }
        // The public listener enforces the client idle timeout, so event streams are exempted
        // here, and they end normally if the adapter breaks them off (endQuietly).
        if (
          response.headers.get("content-type")?.startsWith("text/event-stream") &&
          response.body
        ) {
          server.timeout(request, 0);
          return new Response(endQuietly(response.body), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
        return response;
      },
    });
  } catch (error) {
    removeSocketDirectory();
    throw error;
  }

  // Shutdown: the adapter drains the socket side for up to SHUTDOWN_TIMEOUT, then emits
  // sveltekit:shutdown. A slow public client can still be downloading from this listener at
  // that point, so wait for the public drain too, within the same budget from the signal.
  let deadline = 0;
  let publicDrain: Promise<void> | undefined;
  const startDrain = () => {
    if (publicDrain) return publicDrain;
    deadline = Date.now() + shutdownTimeoutSeconds(environment) * 1000;
    publicDrain = listener.stop();
    return publicDrain;
  };
  // adapter-bun installs its own SIGTERM/SIGINT handlers only when it has finished loading. A
  // signal that arrives earlier is remembered and delivered again once they exist, so the
  // adapter still drains and emits sveltekit:shutdown.
  let loaded = false;
  let earlySignal: NodeJS.Signals | undefined;
  const onSignal = (signal: NodeJS.Signals) => {
    startDrain();
    if (!loaded) earlySignal ??= signal;
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
  // Every exit removes the socket directory, including the adapter's process.exit(1) on a second
  // signal, which skips sveltekit:shutdown (synchronously, as exit handlers must).
  process.once("exit", removeSocketDirectory);
  process.once("sveltekit:shutdown", async () => {
    const drain = startDrain();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const drained = await Promise.race([
      drain.then(() => true),
      new Promise<false>((resolveTimeout) => {
        timer = setTimeout(() => resolveTimeout(false), Math.max(0, deadline - Date.now()));
      }),
    ]);
    clearTimeout(timer);
    if (!drained) await listener.stop(true);
    removeSocketDirectory();
  });

  try {
    await importServer();
  } catch (error) {
    await listener.stop(true);
    removeSocketDirectory();
    throw error;
  }
  loaded = true;
  markReady();
  if (earlySignal) process.kill(process.pid, earlySignal);

  console.log(`Listening on ${listener.url} for ${origin.origin}`);
}

if (import.meta.main) {
  try {
    await serve();
  } catch (error) {
    // A malformed ORIGIN is reported by this exact sentence alone, before anything is bound.
    if (error instanceof Error && error.message === ORIGIN_ERROR) {
      console.error(ORIGIN_ERROR);
      process.exit(1);
    }
    throw error;
  }
}

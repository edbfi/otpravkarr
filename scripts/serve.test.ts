// @vitest-environment node
// scripts/serve.ts runs under Bun; these tests run on Node (Vitest), so the network behaviour is
// exercised by spawning `bun scripts/serve.ts` in a temporary directory whose build/index.js is a
// stand-in adapter (scripts/fixtures/standin-adapter.js).
import { type ChildProcess, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { connect, createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeInteractiveTimeoutMs } from "../src/lib/dispatcharr/client";
import {
  endQuietly,
  forwardPath,
  HOST_HEADER,
  MISSING_ORIGIN_WARNING,
  ORIGIN_ERROR,
  PEER_HEADER,
  PROTOCOL_HEADER,
  parseOrigin,
  prepare,
  shutdownTimeoutSeconds,
} from "./serve";

// The Dispatcharr client reads IDLE_TIMEOUT through SvelteKit's declared private env.
vi.mock("$lib/server/private-env", () => ({ env: {} }));

const SERVE = resolve("scripts/serve.ts");
const STANDIN = resolve("scripts/fixtures/standin-adapter.js");
const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function scratch(): string {
  const directory = mkdtempSync(join(tmpdir(), "serve-test-"));
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as { port: number };
  await new Promise((done) => server.close(done));
  return port;
}

type Started = {
  child: ChildProcess;
  port: number;
  temp: string;
  output: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
};

/** Starts `bun scripts/serve.ts` with a private TMPDIR, so leftover socket directories show. */
async function start(env: Record<string, string>, { waitFor = "ready" } = {}): Promise<Started> {
  const cwd = scratch();
  const temp = scratch();
  mkdirSync(join(cwd, "build"));
  copyFileSync(STANDIN, join(cwd, "build", "index.js"));
  const port = env.PORT ? Number(env.PORT) : await freePort();
  const child = spawn("bun", [SERVE], {
    cwd,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: temp,
      HOST: "127.0.0.1",
      PORT: String(port),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk;
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((done) =>
    child.on("exit", (code, signal) => done({ code, signal })),
  );
  cleanups.push(() => child.kill("SIGKILL"));
  if (waitFor === "ready") {
    const deadline = Date.now() + 10_000;
    while (!/Listening on|standin listening on http/.test(output)) {
      if (Date.now() > deadline || child.exitCode !== null) {
        throw new Error(`serve.ts did not start:\n${output}`);
      }
      await new Promise((done) => setTimeout(done, 25));
    }
  }
  return { child, port, temp, output: () => output, exited };
}

type Reply = { status: number; headers: IncomingMessage["headers"]; body: Buffer };

function call(
  port: number,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<Reply> {
  return new Promise((done, fail) => {
    const req = httpRequest(
      { host: "127.0.0.1", port, path, method: options.method ?? "GET", headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
        );
        res.on("error", fail);
      },
    );
    req.on("error", fail);
    req.end(options.body);
  });
}

async function echo(port: number, options: Parameters<typeof call>[2] = {}) {
  const reply = await call(port, "/echo?x=1", options);
  return JSON.parse(reply.body.toString()) as {
    method: string;
    path: string;
    search: string;
    body: string;
    headers: Record<string, string>;
    env: Record<string, string | null>;
  };
}

type Streamed = { body: string; complete: boolean; error?: unknown };

/** Reads a streamed reply to its end, recording whether it ended normally or broke off. */
function stream(port: number, path: string): Promise<Streamed> {
  return new Promise((done) => {
    const req = httpRequest({ host: "127.0.0.1", port, path }, (res) => {
      let body = "";
      let error: unknown;
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
      });
      res.on("error", (failure) => {
        error = failure;
      });
      res.on("close", () => done({ body, complete: res.complete, error }));
    });
    req.on("error", (error) => done({ body: "", complete: false, error }));
    req.end();
  });
}

const socketDirectories = (temp: string) =>
  readdirSync(temp).filter((name) => name.startsWith("otpravkarr-"));

describe("parseOrigin", () => {
  it.each([
    ["a LAN address with a port", "http://192.168.1.10:3000", "http://192.168.1.10:3000"],
    ["an https host", "https://otpravkarr.example.com", "https://otpravkarr.example.com"],
    ["a trailing slash", "http://localhost:4173/", "http://localhost:4173"],
    [
      "whitespace, uppercase and a default port",
      "  HTTP://Otpravkarr.Example:80/ ",
      "http://otpravkarr.example",
    ],
    ["an explicit https default port", "https://example.com:443", "https://example.com"],
    ["an IDN host", "http://bücher.example:8080", "http://xn--bcher-kva.example:8080"],
    ["an IPv6 host", "http://[::1]:3000", "http://[::1]:3000"],
  ])("accepts %s and returns the canonical origin", (_reason, value, canonical) => {
    expect(parseOrigin(value)).toBe(canonical);
  });

  it.each(["", "   "])("treats %j as unset", (value) => {
    expect(parseOrigin(value)).toBeUndefined();
  });

  it.each([
    ["a path", "http://example.com/app"],
    ["a query", "http://example.com/?a=1"],
    ["an empty query", "http://example.com?"],
    ["a fragment", "http://example.com/#top"],
    ["an empty fragment", "http://example.com#"],
    ["credentials", "http://user:pass@example.com"],
    ["a user name only", "http://user@example.com"],
    ["a non-http(s) scheme", "ftp://example.com"],
    ["no host", "http://"],
    ["garbage", "not a url"],
  ])("rejects %s with the shared startup error", (_reason, value) => {
    expect(() => parseOrigin(value)).toThrow(
      "ORIGIN must be a bare http(s) origin such as http://192.168.1.10:3000 (no path, query, fragment or credentials).",
    );
    expect(() => parseOrigin(value)).toThrow(new Error(ORIGIN_ERROR));
  });

  it("never echoes credentials, even when the URL parser rejects the value", () => {
    const secret = `pw-${Math.random().toString(36).slice(2)}`;
    for (const value of [
      `http://user:${secret}@example.com/x`,
      `http://user:${secret}@exa mple.com`,
    ]) {
      let caught: unknown;
      try {
        parseOrigin(value);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).cause).toBeUndefined();
      expect(Object.keys(caught as object)).toEqual([]);
      expect(String((caught as Error).message)).not.toContain(secret);
      expect(JSON.stringify(caught)).not.toContain(secret);
    }
  });
});

describe("prepare", () => {
  it("maps IDLE_TIMEOUT only when it is set, and an explicit CONNECTION_IDLE_TIMEOUT wins", () => {
    const mapped: Record<string, string | undefined> = { IDLE_TIMEOUT: "20" };
    prepare(mapped);
    expect(mapped.CONNECTION_IDLE_TIMEOUT).toBe("20");

    const explicit: Record<string, string | undefined> = {
      IDLE_TIMEOUT: "20",
      CONNECTION_IDLE_TIMEOUT: "5",
    };
    prepare(explicit);
    expect(explicit.CONNECTION_IDLE_TIMEOUT).toBe("5");
    expect(explicit.IDLE_TIMEOUT).toBe("5");

    const unset: Record<string, string | undefined> = {};
    prepare(unset);
    expect(unset).not.toHaveProperty("CONNECTION_IDLE_TIMEOUT");
  });

  it("without ORIGIN sets nothing for a front, and warns unless PROTOCOL_HEADER is set", () => {
    const environment: Record<string, string | undefined> = { PORT: "3000" };
    expect(prepare(environment)).toEqual({ mode: "direct", warning: MISSING_ORIGIN_WARNING });
    expect(environment).toEqual({ PORT: "3000" });

    expect(prepare({ PROTOCOL_HEADER: "x-forwarded-proto" })).toEqual({
      mode: "direct",
      warning: null,
    });
  });

  it("warns in the words every edbfi app uses", () => {
    expect(MISSING_ORIGIN_WARNING).toBe(
      "ORIGIN is not set: Otpravkarr assumes it is served over HTTPS behind a proxy that " +
        "preserves the Host header. Over plain HTTP, signing in and saving changes will fail. " +
        "Set ORIGIN to the address users open, for example ORIGIN=http://192.168.1.10:3000.",
    );
  });

  it("treats a blank ORIGIN as unset, for the app too", () => {
    const environment: Record<string, string | undefined> = { ORIGIN: "  " };
    expect(prepare(environment)).toEqual({ mode: "direct", warning: MISSING_ORIGIN_WARNING });
    expect(environment).not.toHaveProperty("ORIGIN");
  });

  it("exports the canonical ORIGIN, so the app compares the string the front sends", () => {
    const environment: Record<string, string | undefined> = {
      ORIGIN: " HTTP://LAN.Example:80/ ",
    };
    const plan = prepare(environment);
    if (plan.mode !== "front") throw new Error("expected the front");
    cleanups.push(() => rmSync(plan.directory, { recursive: true, force: true }));
    expect(environment.ORIGIN).toBe("http://lan.example");
    expect(plan.origin.origin).toBe("http://lan.example");
  });

  it("rejects a malformed ORIGIN before creating a socket directory", () => {
    const before = readdirSync(tmpdir()).filter((entry) => entry.startsWith("otpravkarr-"));
    expect(() => prepare({ ORIGIN: "http://example.com/app" })).toThrow(new Error(ORIGIN_ERROR));
    const after = readdirSync(tmpdir()).filter((entry) => entry.startsWith("otpravkarr-"));
    expect(after).toEqual(before);
  });

  it("with ORIGIN prepares a private socket and the front's headers", () => {
    const environment: Record<string, string | undefined> = {
      ORIGIN: "http://192.168.1.10:3000",
      IDLE_TIMEOUT: "15",
      PORT_HEADER: "x-forwarded-port",
      PROTOCOL_HEADER: "x-forwarded-proto",
    };
    const plan = prepare(environment);
    if (plan.mode !== "front") throw new Error("expected the front");
    cleanups.push(() => rmSync(plan.directory, { recursive: true, force: true }));

    expect(plan.hostname).toBe("0.0.0.0");
    expect(plan.port).toBe(3000);
    expect(plan.idleTimeout).toBe(15);
    expect(plan.ownPeerHeader).toBe(true);
    expect(plan.directory.startsWith(join(tmpdir(), "otpravkarr-"))).toBe(true);
    expect(existsSync(plan.directory)).toBe(true);
    expect(plan.socket).toBe(join(plan.directory, "app.sock"));
    expect(environment.SOCKET_PATH).toBe(plan.socket);
    expect(environment.PROTOCOL_HEADER).toBe(PROTOCOL_HEADER);
    expect(environment.HOST_HEADER).toBe(HOST_HEADER);
    expect(environment.ADDRESS_HEADER).toBe(PEER_HEADER);
    expect(environment).not.toHaveProperty("PORT_HEADER");
    expect(environment.CONNECTION_IDLE_TIMEOUT).toBe("0");
  });

  it("keeps an operator ADDRESS_HEADER and leaves Bun's idle default when none is set", () => {
    const environment: Record<string, string | undefined> = {
      ORIGIN: "https://otpravkarr.example.com",
      ADDRESS_HEADER: "x-forwarded-for",
    };
    const plan = prepare(environment);
    if (plan.mode !== "front") throw new Error("expected the front");
    cleanups.push(() => rmSync(plan.directory, { recursive: true, force: true }));
    expect(plan.ownPeerHeader).toBe(false);
    expect(plan.idleTimeout).toBeUndefined();
    expect(environment.ADDRESS_HEADER).toBe("x-forwarded-for");
  });

  it.each([
    ["PORT", { ORIGIN: "http://a.example", PORT: "http" }],
    ["PORT", { ORIGIN: "http://a.example", PORT: "70000" }],
    ["CONNECTION_IDLE_TIMEOUT", { ORIGIN: "http://a.example", CONNECTION_IDLE_TIMEOUT: "300" }],
  ])("rejects an invalid %s before creating a socket directory", (name, environment) => {
    const before = readdirSync(tmpdir()).filter((entry) => entry.startsWith("otpravkarr-"));
    expect(() => prepare({ ...environment })).toThrow(new RegExp(`^${name} must be an integer`));
    const after = readdirSync(tmpdir()).filter((entry) => entry.startsWith("otpravkarr-"));
    expect(after).toEqual(before);
  });

  // Dispatcharr interactive requests must finish inside the client-facing idle window: the
  // front's idleTimeout with ORIGIN, the adapter's CONNECTION_IDLE_TIMEOUT without it, and
  // Bun's 10s default when neither is set.
  it.each([
    ["direct, IDLE_TIMEOUT", {}, { IDLE_TIMEOUT: "20" }, 20],
    ["direct, CONNECTION_IDLE_TIMEOUT only", {}, { CONNECTION_IDLE_TIMEOUT: "5" }, 5],
    ["direct, neither", {}, {}, 10],
    ["fronted, IDLE_TIMEOUT", { ORIGIN: "http://a.example" }, { IDLE_TIMEOUT: "20" }, 20],
    [
      "fronted, CONNECTION_IDLE_TIMEOUT only",
      { ORIGIN: "http://a.example" },
      { CONNECTION_IDLE_TIMEOUT: "5" },
      5,
    ],
    ["fronted, neither", { ORIGIN: "http://a.example" }, {}, 10],
  ])(
    "keeps the Dispatcharr interactive timeout inside the idle window (%s)",
    (_case, base, idle, window) => {
      const environment: Record<string, string | undefined> = { ...base, ...idle };
      const plan = prepare(environment);
      if (plan.mode === "front")
        cleanups.push(() => rmSync(plan.directory, { recursive: true, force: true }));
      const effective =
        plan.mode === "front"
          ? (plan.idleTimeout ?? 10)
          : Number(environment.CONNECTION_IDLE_TIMEOUT ?? 10);
      expect(effective).toBe(window);
      // client.ts reads IDLE_TIMEOUT (default 10) to size its interactive timeout.
      const idleSeconds = Number(environment.IDLE_TIMEOUT ?? 10);
      expect(idleSeconds).toBe(window);
      expect(computeInteractiveTimeoutMs(idleSeconds)).toBeLessThan(effective * 1000);
    },
  );

  it("reads SHUTDOWN_TIMEOUT as the adapter does", () => {
    expect(shutdownTimeoutSeconds({})).toBe(30);
    expect(shutdownTimeoutSeconds({ SHUTDOWN_TIMEOUT: "5" })).toBe(5);
  });
});

describe("forwardPath", () => {
  it.each([
    ["http://x/echo?x=1", "/echo?x=1"],
    ["http://x/_app/immutable/a%20b.js?v=%2F&q", "/_app/immutable/a%20b.js?v=%2F&q"],
    ["http://x//double", "//double"],
    ["http://x/a/../b", "/a/../b"],
    ["http://x", "/"],
    // What Bun gives when the client's Host header is not a valid host.
    ["/p%2Fq?x=%20", "/p%2Fq?x=%20"],
    ["/login?next=http://x/y", "/login?next=http://x/y"],
    ["http://[::1/p?x", "/p?x"],
  ])("forwards %s as %s", (url, path) => {
    expect(forwardPath(url)).toBe(path);
  });
});

describe("endQuietly", () => {
  it("passes chunks through and ends normally instead of erroring", async () => {
    let step = 0;
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        step++;
        if (step === 1) controller.enqueue(new TextEncoder().encode("data: one\n\n"));
        else controller.error(new Error("socket closed"));
      },
    });
    expect(await new Response(endQuietly(broken)).text()).toBe("data: one\n\n");
  });

  it("cancels the upstream when the client goes away", async () => {
    let cancelled = false;
    const upstream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("."));
      },
      cancel() {
        cancelled = true;
      },
    });
    const reader = endQuietly(upstream).getReader();
    await reader.read();
    await reader.cancel();
    expect(cancelled).toBe(true);
  });
});

describe("serve.ts process", () => {
  it("without ORIGIN loads the adapter directly and warns exactly once", async () => {
    const server = await start({});
    const seen = await echo(server.port);
    expect(seen.env).toMatchObject({ SOCKET_PATH: null, PROTOCOL_HEADER: null, HOST_HEADER: null });
    expect(server.output().split(MISSING_ORIGIN_WARNING).length - 1).toBe(1);
    expect(server.output()).not.toContain("Listening on http");
  });

  it("does not warn when ORIGIN or PROTOCOL_HEADER is set", async () => {
    const withProtocol = await start({ PROTOCOL_HEADER: "x-forwarded-proto" });
    await echo(withProtocol.port);
    expect(withProtocol.output()).not.toContain(MISSING_ORIGIN_WARNING);

    const port = await freePort();
    const fronted = await start({ ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port) });
    await echo(fronted.port);
    expect(fronted.output()).not.toContain(MISSING_ORIGIN_WARNING);
  });

  it("with ORIGIN fronts the adapter and overwrites the origin and peer headers", async () => {
    const port = await freePort();
    const server = await start({ ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port) });
    expect(server.output()).toContain(`for http://127.0.0.1:${port}`);

    const seen = await echo(server.port, {
      headers: {
        host: "evil.example",
        [PROTOCOL_HEADER]: "https",
        [HOST_HEADER]: "evil.example",
        [PEER_HEADER]: "203.0.113.9",
        "x-forwarded-for": "203.0.113.9",
      },
    });
    expect(seen.env).toMatchObject({
      PROTOCOL_HEADER,
      HOST_HEADER,
      ADDRESS_HEADER: PEER_HEADER,
      PORT_HEADER: null,
      CONNECTION_IDLE_TIMEOUT: "0",
    });
    expect(seen.env.SOCKET_PATH).toMatch(/otpravkarr-[^/]+\/app\.sock$/);
    expect(seen.headers[PROTOCOL_HEADER]).toBe("http");
    expect(seen.headers[HOST_HEADER]).toBe(`127.0.0.1:${port}`);
    expect(seen.headers[PEER_HEADER]).toBe("127.0.0.1");
    // Forwarded headers pass through untouched; the adapter only trusts the ones it is told to.
    expect(seen.headers["x-forwarded-for"]).toBe("203.0.113.9");
  });

  // The app reads ORIGIN for its own allowlist and the bootstrap banner (`${ORIGIN}/setup`), so
  // a trailing slash in the operator's value must not reach it.
  it("gives the adapter the canonical ORIGIN before it loads", async () => {
    const port = await freePort();
    const server = await start({ ORIGIN: `http://127.0.0.1:${port}/`, PORT: String(port) });
    const seen = await echo(server.port);
    expect(seen.env.ORIGIN).toBe(`http://127.0.0.1:${port}`);
    expect(`${seen.env.ORIGIN}/setup`).toBe(`http://127.0.0.1:${port}/setup`);
    expect(server.output()).toContain(`for http://127.0.0.1:${port}\n`);
  });

  it("passes an operator ADDRESS_HEADER through and drops a client-supplied peer header", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      ADDRESS_HEADER: "x-forwarded-for",
    });
    const seen = await echo(server.port, {
      headers: { [PEER_HEADER]: "203.0.113.9", "x-forwarded-for": "198.51.100.7" },
    });
    expect(seen.env.ADDRESS_HEADER).toBe("x-forwarded-for");
    expect(seen.headers["x-forwarded-for"]).toBe("198.51.100.7");
    expect(seen.headers).not.toHaveProperty(PEER_HEADER);
  });

  it("forwards method, path, query and body, and leaves redirects and encodings alone", async () => {
    const port = await freePort();
    const server = await start({ ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port) });

    const posted = await echo(server.port, { method: "POST", body: "hello" });
    expect(posted).toMatchObject({ method: "POST", path: "/echo", search: "?x=1", body: "hello" });
    const got = await echo(server.port);
    expect(got).toMatchObject({ method: "GET", body: "" });

    const redirect = await call(server.port, "/redirect");
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe("/elsewhere");

    const gzip = await call(server.port, "/gzip", { headers: { "accept-encoding": "gzip" } });
    expect(gzip.headers["content-encoding"]).toBe("gzip");
    expect(gzip.body.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
  });

  // Bun gives a bare path or an unparsable URL for such a request; the front must still forward
  // it and pass on the adapter's own answer (adapter-bun: 400), not fail itself with a 500.
  it("forwards a request whose Host header is not a valid host", async () => {
    const port = await freePort();
    const server = await start({ ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port) });
    for (const host of ["exa mple.com", "[::1", "a:99999"]) {
      const reply = await call(server.port, "/echo?x=%20", { headers: { host } });
      expect(reply.status, host).toBe(400);
      expect(reply.body.toString(), host).toBe("Bad Request");
    }
    const valid = await echo(server.port, { headers: { host: "evil.example" } });
    expect(valid.search).toBe("?x=1");
    expect(valid.headers[HOST_HEADER]).toBe(`127.0.0.1:${port}`);
    expect(server.output()).not.toMatch(/Invalid URL|TypeError/);
  });

  it("propagates a client abort to the adapter", async () => {
    const port = await freePort();
    const marker = join(scratch(), "aborted");
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      STANDIN_ABORT_FILE: marker,
    });
    await new Promise<void>((done) => {
      const req = httpRequest({ host: "127.0.0.1", port: server.port, path: "/hold" }, (res) => {
        res.once("data", () => {
          req.destroy();
          done();
        });
      });
      req.on("error", () => {});
      req.end();
    });
    await expect.poll(() => existsSync(marker), { timeout: 5000 }).toBe(true);
  });

  it("answers 503 when the adapter is unreachable", async () => {
    const port = await freePort();
    const server = await start({ ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port) });
    await call(server.port, "/stop");
    await new Promise((done) => setTimeout(done, 100));
    const reply = await call(server.port, "/echo");
    expect(reply.status).toBe(503);
  });

  it("keeps an idle event stream open past the client idle timeout", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      IDLE_TIMEOUT: "1",
    });
    const reply = await call(server.port, "/sse?gap=2500");
    expect(reply.headers["content-type"]).toBe("text/event-stream");
    expect(reply.body.toString()).toBe("data: one\n\ndata: two\n\n");
  }, 10_000);

  // Bun 1.4.2 runs the idle timer while a handler awaits fetch(): without the fix, a request the
  // adapter answers after the idle window got an empty reply (a closed connection).
  it("answers requests the adapter takes longer than the client idle timeout to answer", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      IDLE_TIMEOUT: "1",
    });
    const [get, post] = await Promise.all([
      call(server.port, "/slow?ms=4500"),
      call(server.port, "/slow?ms=4500", { method: "POST", body: "abc" }),
    ]);
    expect([get.status, get.body.toString()]).toEqual([200, "slow 0"]);
    expect([post.status, post.body.toString()]).toEqual([200, "slow 3"]);
  }, 15_000);

  /** Sends `raw` on a new connection; the seconds until the server closes it (Infinity: 10 s). */
  function secondsUntilClosed(port: number, raw: string): Promise<number> {
    return new Promise((done) => {
      const started = Date.now();
      const socket = connect(port, "127.0.0.1", () => socket.write(raw));
      const timer = setTimeout(() => done(Number.POSITIVE_INFINITY), 10_000);
      socket.on("data", () => {});
      socket.on("error", () => {});
      socket.on("close", () => {
        clearTimeout(timer);
        done((Date.now() - started) / 1000);
      });
      cleanups.push(() => socket.destroy());
    });
  }

  it("still closes a client that stalls before its request body is complete", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      IDLE_TIMEOUT: "1",
    });
    const stalled = secondsUntilClosed(
      server.port,
      "POST /slow?ms=0 HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 100\r\n\r\nhello",
    );
    expect(await stalled).toBeLessThan(8);
  }, 15_000);

  it("re-arms the client idle timeout once the adapter has answered", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      IDLE_TIMEOUT: "1",
    });
    // A keep-alive connection that goes idle after a slow answer is closed like any other.
    const idle = secondsUntilClosed(
      server.port,
      "GET /slow?ms=1500 HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n",
    );
    expect(await idle).toBeLessThan(8);
  }, 15_000);

  // This pins the outcome (a slow client still downloading when the adapter has drained and
  // emitted sveltekit:shutdown gets every byte; the front stops accepting and removes the socket),
  // not the mechanism: on Bun 1.4.2 the body is already buffered in the front by then, and a front
  // that force-closes at sveltekit:shutdown passed this test too. The deadline end of the budget is
  // pinned by the SHUTDOWN_TIMEOUT=3 test below.
  it("on SIGTERM stops accepting, a slow client still gets every byte, the socket is removed", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      SHUTDOWN_TIMEOUT: "15",
    });
    expect(socketDirectories(server.temp)).toHaveLength(1);

    // Read about 2 MiB/s, so the 8 MiB body is still downloading when the adapter's side has
    // drained and emits sveltekit:shutdown.
    // Bun answers a still-streaming proxied body with chunked encoding, so the check is the
    // byte count against the adapter's known body size.
    const download = new Promise<{ bytes: number; complete: boolean; error?: unknown }>((done) => {
      const req = httpRequest({ host: "127.0.0.1", port: server.port, path: "/big" }, (res) => {
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          res.pause();
          setTimeout(() => res.resume(), Math.ceil(chunk.length / 2048));
        });
        res.on("end", () => done({ bytes, complete: res.complete }));
        res.on("error", (error) => done({ bytes, complete: false, error }));
      });
      req.on("error", (error) => done({ bytes: 0, complete: false, error }));
      req.end();
    });
    await new Promise((done) => setTimeout(done, 300));
    server.child.kill("SIGTERM");

    await expect.poll(() => server.output(), { timeout: 5000 }).toContain("standin drained");
    await expect(call(server.port, "/echo")).rejects.toThrow();

    const result = await download;
    expect(result.error).toBeUndefined();
    expect(result.complete).toBe(true);
    expect(result.bytes).toBe(8 * 1024 * 1024);
    expect(await server.exited).toEqual({ code: 0, signal: null });
    expect(socketDirectories(server.temp)).toEqual([]);
  }, 30_000);

  it("force-closes a client that cannot finish within SHUTDOWN_TIMEOUT", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      SHUTDOWN_TIMEOUT: "3",
    });
    const download = new Promise<number>((done) => {
      const req = httpRequest({ host: "127.0.0.1", port: server.port, path: "/big" }, (res) => {
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          res.pause();
          setTimeout(() => res.resume(), 200);
        });
        res.on("end", () => done(bytes));
        res.on("error", () => done(bytes));
        res.on("close", () => done(bytes));
      });
      req.on("error", () => done(-1));
      req.end();
    });
    await new Promise((done) => setTimeout(done, 300));
    const signalled = Date.now();
    server.child.kill("SIGTERM");

    expect(await server.exited).toEqual({ code: 0, signal: null });
    const elapsed = (Date.now() - signalled) / 1000;
    expect(elapsed).toBeGreaterThanOrEqual(2.5);
    expect(elapsed).toBeLessThan(5);
    expect(await download).toBeLessThan(8 * 1024 * 1024);
    expect(socketDirectories(server.temp)).toEqual([]);
  }, 30_000);

  // The adapter force-closes the streams still open at the end of its shutdown drain. A browser
  // sees that failure, passed on as is, as a connection reset; the front ends an event stream
  // normally instead, and lets every other body fail so a truncated download stays visible.
  it("ends an event stream normally when the adapter breaks it off, and fails other bodies", async () => {
    const ssePort = await freePort();
    const sse = await start({ ORIGIN: `http://127.0.0.1:${ssePort}`, PORT: String(ssePort) });
    const ended = await stream(sse.port, "/break?type=text/event-stream");
    expect(ended).toEqual({ body: "data: one\n\n", complete: true, error: undefined });
    expect(sse.output()).not.toContain("ECONNRESET");

    const plainPort = await freePort();
    const plain = await start({ ORIGIN: `http://127.0.0.1:${plainPort}`, PORT: String(plainPort) });
    const broken = await stream(plain.port, "/break?type=text/plain");
    // Passed on as a failure: the client sees the body break off (a reset), never a normal end.
    expect(broken.complete).toBe(false);
    expect(broken.error).toBeDefined();
  }, 20_000);

  it("on SIGTERM ends a held event stream normally at the drain deadline", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      SHUTDOWN_TIMEOUT: "2",
    });
    const held = stream(server.port, "/sse-hold");
    await new Promise((done) => setTimeout(done, 300));
    const signalled = Date.now();
    server.child.kill("SIGTERM");

    expect(await held).toEqual({ body: "data: one\n\n", complete: true, error: undefined });
    expect(await server.exited).toEqual({ code: 0, signal: null });
    const elapsed = (Date.now() - signalled) / 1000;
    expect(elapsed).toBeGreaterThanOrEqual(1.5);
    expect(elapsed).toBeLessThan(5);
    expect(socketDirectories(server.temp)).toEqual([]);
  }, 20_000);

  it("shuts down cleanly when SIGTERM arrives while the adapter is still loading", async () => {
    const port = await freePort();
    const server = await start(
      { ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port), STANDIN_LOAD_DELAY_MS: "1500" },
      { waitFor: "exit" },
    );
    // The public port is bound before the adapter loads: wait for a TCP connect (an HTTP request
    // would be held until the adapter is ready), then signal mid-load.
    const accepting = () =>
      new Promise<boolean>((done) => {
        const socket = connect(port, "127.0.0.1");
        socket.once("connect", () => {
          socket.destroy();
          done(true);
        });
        socket.once("error", () => done(false));
      });
    await expect.poll(accepting, { timeout: 5000, interval: 25 }).toBe(true);
    expect(server.output()).not.toContain("standin listening");
    server.child.kill("SIGTERM");
    const signalled = Date.now();
    const exited = await Promise.race([
      server.exited,
      new Promise<"timeout">((done) => setTimeout(() => done("timeout"), 8000)),
    ]);
    expect(exited).toEqual({ code: 0, signal: null });
    expect(Date.now() - signalled).toBeLessThan(8000);
    expect(socketDirectories(server.temp)).toEqual([]);
  }, 20_000);

  it("exits 1 and leaves no socket directory on a second signal during adapter load", async () => {
    const port = await freePort();
    const server = await start(
      { ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port), STANDIN_LOAD_DELAY_MS: "3000" },
      { waitFor: "exit" },
    );
    const accepting = () =>
      new Promise<boolean>((done) => {
        const socket = connect(port, "127.0.0.1");
        socket.once("connect", () => {
          socket.destroy();
          done(true);
        });
        socket.once("error", () => done(false));
      });
    await expect.poll(accepting, { timeout: 5000, interval: 25 }).toBe(true);
    expect(socketDirectories(server.temp)).toHaveLength(1);
    server.child.kill("SIGTERM");
    await new Promise((done) => setTimeout(done, 200));
    server.child.kill("SIGTERM");
    expect(await server.exited).toEqual({ code: 1, signal: null });
    expect(server.output()).not.toContain("standin listening");
    expect(socketDirectories(server.temp)).toEqual([]);
  }, 20_000);

  it("removes the socket directory when a second signal forces the exit after loading", async () => {
    const port = await freePort();
    const server = await start({
      ORIGIN: `http://127.0.0.1:${port}`,
      PORT: String(port),
      SHUTDOWN_TIMEOUT: "30",
    });
    // Keep a request in flight so the first signal starts a drain that does not finish.
    await new Promise<void>((done) => {
      const req = httpRequest({ host: "127.0.0.1", port: server.port, path: "/hold" }, (res) => {
        res.once("data", () => done());
        res.on("error", () => {});
      });
      req.on("error", () => {});
      req.end();
    });
    expect(socketDirectories(server.temp)).toHaveLength(1);
    server.child.kill("SIGTERM");
    await new Promise((done) => setTimeout(done, 300));
    // The adapter exits 1 on a second signal, without sveltekit:shutdown.
    server.child.kill("SIGTERM");
    expect(await server.exited).toEqual({ code: 1, signal: null });
    expect(socketDirectories(server.temp)).toEqual([]);
  }, 20_000);

  it("leaves nothing behind when the adapter fails to load", async () => {
    const port = await freePort();
    const server = await start(
      { ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port), STANDIN_THROW: "1" },
      { waitFor: "exit" },
    );
    const { code } = await server.exited;
    expect(code).not.toBe(0);
    expect(server.output()).toContain("stand-in adapter failed to load");
    expect(socketDirectories(server.temp)).toEqual([]);
    const probe: Server = createServer();
    await new Promise<void>((done, fail) => {
      probe.once("error", fail);
      probe.listen(port, "127.0.0.1", done);
    });
    await new Promise((done) => probe.close(done));
  });

  it("fails clearly when the public port is taken, without starting the adapter", async () => {
    const blocker: Server = createServer();
    await new Promise<void>((done) => blocker.listen(0, "127.0.0.1", done));
    cleanups.push(() => blocker.close());
    const { port } = blocker.address() as { port: number };

    const server = await start(
      { ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port) },
      { waitFor: "exit" },
    );
    const { code } = await server.exited;
    expect(code).not.toBe(0);
    expect(server.output()).toMatch(/EADDRINUSE|address already in use|port \d+ in use/i);
    expect(server.output()).not.toContain("standin listening");
    expect(socketDirectories(server.temp)).toEqual([]);
  });

  it("fails clearly on a malformed ORIGIN without echoing it", async () => {
    const secret = `pw-${Math.random().toString(36).slice(2)}`;
    const server = await start(
      { ORIGIN: `http://user:${secret}@exa mple.com` },
      { waitFor: "exit" },
    );
    const { code } = await server.exited;
    expect(code).toBe(1);
    expect(server.output().trim()).toBe(ORIGIN_ERROR);
    expect(server.output()).not.toContain(secret);
    expect(server.output()).not.toContain("standin listening");
  });
});

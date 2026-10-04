// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn((_id: string) => {}),
  appendAuditLog: vi.fn(),
}));

vi.mock("$lib/db/repositories/sessions", () => ({
  deleteSession: mocks.deleteSession,
}));

vi.mock("$lib/db/repositories/audit", () => ({
  appendAuditLog: mocks.appendAuditLog,
}));

vi.mock("$lib/db/types", () => ({
  AuditAction: {
    ADMIN_LOGOUT: "admin.logout",
  },
}));

vi.mock("$lib/server/auth", () => ({
  SESSION_COOKIE_NAME: "otpravkarr_session",
  // Same shape as src/lib/server/auth.ts: Secure follows the request's scheme (M13).
  sessionCookieDeleteOptions: (url: URL) => ({ path: "/", secure: url.protocol === "https:" }),
}));

const SIGNOUT_URL = new URL("http://localhost/api/internal/signout");

function createCookies(sessionId?: string) {
  const set = vi.fn();
  const deleteFn = vi.fn();
  const get = vi.fn((name: string) => {
    if (name === "otpravkarr_session") return sessionId;
    return undefined;
  });
  return { cookies: { get, set, delete: deleteFn }, set, deleteFn };
}

function resetAll() {
  mocks.deleteSession.mockClear();
  mocks.appendAuditLog.mockClear();
}

describe("signout endpoint", () => {
  beforeEach(() => {
    resetAll();
  });

  it("deletes session and redirects user session to /", async () => {
    const { POST } = await import("./+server");
    const { cookies, deleteFn } = createCookies("sess-123");

    await expect(
      POST({
        cookies,
        request: new Request("http://localhost/api/internal/signout", { method: "POST" }),
        locals: {
          session: { id: "sess-123", type: "user", userRef: "1" },
        },
        url: SIGNOUT_URL,
        getClientAddress: () => "127.0.0.1",
      } as unknown as Parameters<typeof POST>[0]),
    ).rejects.toMatchObject({
      status: 303,
      location: "/",
    });

    expect(mocks.deleteSession).toHaveBeenCalledWith("sess-123");
    expect(deleteFn).toHaveBeenCalledWith(
      "otpravkarr_session",
      expect.objectContaining({ path: "/" }),
    );
    expect(mocks.appendAuditLog).not.toHaveBeenCalled();
  });

  it("deletes session and redirects admin session to /login", async () => {
    const { POST } = await import("./+server");
    const { cookies, deleteFn } = createCookies("sess-456");

    await expect(
      POST({
        cookies,
        request: new Request("http://localhost/api/internal/signout", { method: "POST" }),
        locals: {
          session: { id: "sess-456", type: "admin", userRef: "admin" },
          admin: { id: 1, username: "admin" },
        },
        url: SIGNOUT_URL,
        getClientAddress: () => "10.0.0.1",
      } as unknown as Parameters<typeof POST>[0]),
    ).rejects.toMatchObject({
      status: 303,
      location: "/login",
    });

    expect(mocks.deleteSession).toHaveBeenCalledWith("sess-456");
    expect(deleteFn).toHaveBeenCalledWith(
      "otpravkarr_session",
      expect.objectContaining({ path: "/" }),
    );
  });

  it("appends audit log for admin logout", async () => {
    const { POST } = await import("./+server");
    const { cookies } = createCookies("sess-456");

    try {
      await POST({
        cookies,
        request: new Request("http://localhost/api/internal/signout", { method: "POST" }),
        locals: {
          session: { id: "sess-456", type: "admin", userRef: "admin" },
          admin: { id: 1, username: "admin" },
        },
        url: SIGNOUT_URL,
        getClientAddress: () => "10.0.0.1",
      } as unknown as Parameters<typeof POST>[0]);
    } catch {
      // redirect expected
    }

    expect(mocks.appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin",
        action: "admin.logout",
        ipAddress: "10.0.0.1",
      }),
    );
  });

  it("handles missing session cookie gracefully", async () => {
    const { POST } = await import("./+server");
    const { cookies } = createCookies(undefined);

    await expect(
      POST({
        cookies,
        request: new Request("http://localhost/api/internal/signout", { method: "POST" }),
        locals: {},
        url: SIGNOUT_URL,
        getClientAddress: () => "127.0.0.1",
      } as unknown as Parameters<typeof POST>[0]),
    ).rejects.toMatchObject({
      status: 303,
      location: "/login",
    });

    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });

  it("returns JSON response when Accept header includes application/json (user session)", async () => {
    const { POST } = await import("./+server");
    const { cookies, deleteFn } = createCookies("sess-json-1");

    const response = await POST({
      cookies,
      request: new Request("http://localhost/api/internal/signout", {
        method: "POST",
        headers: { Accept: "application/json" },
      }),
      locals: {
        session: { id: "sess-json-1", type: "user", userRef: "1" },
      },
      url: SIGNOUT_URL,
      getClientAddress: () => "127.0.0.1",
    } as unknown as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, redirectTo: "/" });
    expect(mocks.deleteSession).toHaveBeenCalledWith("sess-json-1");
    expect(deleteFn).toHaveBeenCalledWith(
      "otpravkarr_session",
      expect.objectContaining({ path: "/" }),
    );
  });

  it("returns JSON response when Accept header includes application/json (admin session)", async () => {
    const { POST } = await import("./+server");
    const { cookies, deleteFn } = createCookies("sess-json-2");

    const response = await POST({
      cookies,
      request: new Request("http://localhost/api/internal/signout", {
        method: "POST",
        headers: { Accept: "application/json" },
      }),
      locals: {
        session: { id: "sess-json-2", type: "admin", userRef: "admin" },
        admin: { id: 1, username: "admin" },
      },
      url: SIGNOUT_URL,
      getClientAddress: () => "10.0.0.1",
    } as unknown as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, redirectTo: "/login" });
    expect(mocks.deleteSession).toHaveBeenCalledWith("sess-json-2");
    expect(deleteFn).toHaveBeenCalledWith(
      "otpravkarr_session",
      expect.objectContaining({ path: "/" }),
    );
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "admin",
        action: "admin.logout",
        ipAddress: "10.0.0.1",
      }),
    );
  });

  it("does not append audit log for non-admin signout", async () => {
    const { POST } = await import("./+server");
    const { cookies } = createCookies("sess-789");

    try {
      await POST({
        cookies,
        request: new Request("http://localhost/api/internal/signout", { method: "POST" }),
        locals: {
          session: { id: "sess-789", type: "user", userRef: "42" },
        },
        url: SIGNOUT_URL,
        getClientAddress: () => "127.0.0.1",
      } as unknown as Parameters<typeof POST>[0]);
    } catch {
      // redirect expected
    }

    expect(mocks.appendAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ["https://otpravkarr.example.com/api/internal/signout", true],
    ["http://192.168.1.10:3000/api/internal/signout", false],
  ])("deletes the session cookie for %s with secure: %s (M13)", async (href, secure) => {
    const { POST } = await import("./+server");
    const { cookies, deleteFn } = createCookies("sess-m13");

    await expect(
      POST({
        cookies,
        request: new Request(href, { method: "POST" }),
        url: new URL(href),
        locals: { session: { id: "sess-m13", type: "user", userRef: "1" } },
        getClientAddress: () => "127.0.0.1",
      } as unknown as Parameters<typeof POST>[0]),
    ).rejects.toMatchObject({ status: 303 });

    expect(deleteFn).toHaveBeenCalledWith("otpravkarr_session", { path: "/", secure });
  });
});

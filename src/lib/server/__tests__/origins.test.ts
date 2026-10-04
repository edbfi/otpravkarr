// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  canonicalOrigin,
  effectiveAllowedOrigins,
  selectActivePublicOrigin,
} from "$lib/server/origins";

describe("selectActivePublicOrigin", () => {
  it("uses configured non-loopback origin when present", () => {
    expect(selectActivePublicOrigin("https://public.example.com", "http://127.0.0.1:5173")).toBe(
      "https://public.example.com",
    );
  });

  it("falls back to request origin when configured origin is empty", () => {
    expect(selectActivePublicOrigin("", "http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
  });

  it("uses configured origin when configured origin is stale loopback (avoids Host header influence)", () => {
    expect(selectActivePublicOrigin("http://localhost:3000", "http://127.0.0.1:5173")).toBe(
      "http://localhost:3000",
    );
  });

  it("preserves the active 127.0.0.1 loopback hostname when it matches the configured service", () => {
    expect(selectActivePublicOrigin("http://localhost:3000", "http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("preserves the active localhost loopback hostname when it matches the configured service", () => {
    expect(selectActivePublicOrigin("http://127.0.0.1:3000", "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("does not treat hostnames that only start with 127 as loopback", () => {
    expect(selectActivePublicOrigin("http://localhost:3000", "http://127.evil.com:3000")).toBe(
      "http://localhost:3000",
    );
  });
});

describe("effectiveAllowedOrigins", () => {
  it("always includes ORIGIN, in canonical form, before the stored origins", () => {
    expect(
      effectiveAllowedOrigins(["http://old.example:3000"], "HTTP://New.Example:80/", "x"),
    ).toEqual(["http://new.example", "http://old.example:3000"]);
  });

  it("allows ORIGIN alone when nothing is stored", () => {
    expect(effectiveAllowedOrigins([], "http://192.168.1.10:3000", "https://ignored")).toEqual([
      "http://192.168.1.10:3000",
    ]);
  });

  it("without ORIGIN uses the stored origins, or the request origin when none are stored", () => {
    expect(effectiveAllowedOrigins(["https://a.example"], undefined, "https://b.example")).toEqual([
      "https://a.example",
    ]);
    expect(effectiveAllowedOrigins([], "", "https://b.example")).toEqual(["https://b.example"]);
  });
});

describe("canonicalOrigin", () => {
  it("lowercases, drops a default port and a trailing slash, and rejects non-origins", () => {
    expect(canonicalOrigin(" HTTPS://Example.COM:443/ ")).toBe("https://example.com");
    expect(canonicalOrigin("null")).toBeNull();
    expect(canonicalOrigin("not a url")).toBeNull();
    expect(canonicalOrigin(undefined)).toBeNull();
  });
});

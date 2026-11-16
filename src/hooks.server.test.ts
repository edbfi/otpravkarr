import type { RequestEvent } from "@sveltejs/kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/env", () => ({ building: true, dev: false }));
vi.mock("$app/env/private", () => ({}));

const { handleError } = await import("./hooks.server.ts");

let lines: string[];

beforeEach(() => {
	lines = [];
	vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
		lines.push(String(chunk));
		return true;
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

const url = "http://app.test/setup?token=abcd-efgh-ijkl";
const event = { request: new Request(url, { method: "POST" }), url: new URL(url) } as RequestEvent;

describe("handleError", () => {
	it("logs an error the app's own code threw, and keeps SvelteKit's 500 and message", async () => {
		const result = await handleError({ kind: "unknown", error: new Error("boom"), event });
		expect(result).toBeUndefined();
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0] ?? "")).toMatchObject({
			level: "error",
			source: "request",
			message: "unexpected error",
			metadata: { method: "POST", path: "/setup", error: { name: "Error", message: "boom" } },
		});
	});

	it("logs nothing for the errors it expects: the app's own, SvelteKit's and validation's", async () => {
		const status = { status: 404, message: "Not Found" };
		await handleError({ kind: "app", error: { status: 404, message: "Not found" }, event });
		await handleError({ kind: "framework", error: status, event });
		await handleError({ kind: "validation", error: status, issues: [], event });
		expect(lines).toEqual([]);
	});
});

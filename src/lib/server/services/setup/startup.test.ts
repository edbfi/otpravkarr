import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "@tursodatabase/database";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "#lib/server/config/config-error.ts";
import { startUp } from "./startup.ts";

let root: string;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "otpravkarr-startup-"));
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

/** What startup wrote to standard output during the current test. */
let lines: string[];

beforeEach(() => {
	lines = [];
	vi.spyOn(process.stdout, "write").mockImplementation((chunk, ...rest: unknown[]) => {
		lines.push(String(chunk));
		// `flushLogs` waits for each entry's write callback, so the mock calls it.
		const done = rest.find((arg) => typeof arg === "function") as (() => void) | undefined;
		done?.();
		return true;
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** Runs `run`, ignoring its failure, and returns what it wrote to standard output. */
async function stdoutOf(run: () => Promise<unknown>): Promise<string[]> {
	await run().catch(() => {});
	return lines;
}

const key = () => crypto.getRandomValues(new Uint8Array(32)).toBase64();

async function failure(path: string): Promise<ConfigError> {
	try {
		await startUp({ OTPRAVKARR_SECRET_KEY: key(), OTPRAVKARR_DATABASE_PATH: path });
	} catch (error) {
		if (error instanceof ConfigError) return error;
		throw error;
	}
	throw new Error("startup finished");
}

describe("startUp", () => {
	it("opens and migrates the database at the path", async () => {
		const path = join(root, "data", "app.db");
		await startUp({ OTPRAVKARR_SECRET_KEY: key(), OTPRAVKARR_DATABASE_PATH: path });
		// Turso creates the file on open, so the migration step shows only in the tables.
		const db = await connect(path);
		try {
			const tables = (await (
				await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
			).all()) as { name: string }[];
			expect(tables.map((table) => table.name)).toEqual(
				expect.arrayContaining(["__drizzle_migrations", "owner", "settings"]),
			);
		} finally {
			db.close();
		}
	});

	// Turso's own messages hold the path, so startup replaces them.
	it("refuses a path that is a directory, naming the variable but not the path", async () => {
		const path = join(root, "a-directory");
		await mkdir(path);
		const error = await failure(path);
		expect(error.message).toBe(
			"OTPRAVKARR_DATABASE_PATH names a file that can't be opened as a database (I/O error (open): is a directory)",
		);
	});

	it("logs a failed step as one error entry before throwing it", async () => {
		const path = join(root, "logged-directory");
		await mkdir(path);
		const lines = await stdoutOf(() =>
			startUp({ OTPRAVKARR_SECRET_KEY: key(), OTPRAVKARR_DATABASE_PATH: path }),
		);
		expect(lines).toHaveLength(1);
		const entry = JSON.parse(lines[0] ?? "");
		expect(entry).toMatchObject({
			level: "error",
			source: "startup",
			message: "startup failed",
			metadata: { error: { name: "ConfigError" } },
		});
		expect(lines[0]).not.toContain(root);
	});

	it("throws only once the failure's entry has left the process", async () => {
		const path = join(root, "flushed-directory");
		await mkdir(path);
		const pending: (() => void)[] = [];
		vi.mocked(process.stdout.write).mockImplementation((chunk, ...rest: unknown[]) => {
			lines.push(String(chunk));
			const done = rest.find((arg) => typeof arg === "function") as (() => void) | undefined;
			if (done) pending.push(done);
			return true;
		});
		let settled = false;
		const failure = startUp({ OTPRAVKARR_SECRET_KEY: key(), OTPRAVKARR_DATABASE_PATH: path }).catch(
			(error: unknown) => {
				settled = true;
				return error;
			},
		);
		await vi.waitFor(() => expect(pending).toHaveLength(1));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(settled).toBe(false);
		for (const done of pending) done();
		expect(await failure).toBeInstanceOf(ConfigError);
	});

	it("refuses an OTPRAVKARR_LOG_DEBUG that isn't true or false, before the database opens", async () => {
		const path = join(root, "never-created", "app.db");
		const error = await startUp({
			OTPRAVKARR_SECRET_KEY: key(),
			OTPRAVKARR_DATABASE_PATH: path,
			OTPRAVKARR_LOG_DEBUG: "yes",
		}).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ConfigError);
		expect((error as ConfigError).variable).toBe("OTPRAVKARR_LOG_DEBUG");
		// `Bun.file().exists()` is false for any folder, so the folder is checked with `stat`.
		await expect(stat(join(root, "never-created"))).rejects.toThrow();
	});

	it("refuses a file that isn't a database, without echoing the path", async () => {
		const path = join(root, "text.db");
		await writeFile(path, "not a database, only text that is long enough to have a header\n");
		const error = await failure(path);
		expect(error.message).toMatch(/^OTPRAVKARR_DATABASE_PATH names a file that can't be opened/);
		expect(error.message).not.toContain(root);
	});
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DrizzleQueryError } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Database, openDatabase, withoutBoundValues } from "./client.ts";
import { migrateDatabase } from "./migrate.ts";
import { settings } from "./settings.ts";

let root: string;
let db: Database;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "otpravkarr-client-"));
	db = await openDatabase(join(root, "app.db"));
	await migrateDatabase(db);
});

afterAll(async () => {
	db.$client.close();
	await rm(root, { recursive: true, force: true });
});

const keys = async () => (await db.select({ key: settings.key }).from(settings)).map((r) => r.key);

describe("openDatabase", () => {
	// D5: Drizzle 1.0.0-rc.4 could roll back unrelated writes that share the connection.
	it("keeps a concurrent, unrelated write when a transaction rolls back", async () => {
		const updatedAt = new Date();
		let inserted!: () => void;
		const insertedInside = new Promise<void>((resolve) => {
			inserted = resolve;
		});
		let release!: () => void;
		const rollBack = new Promise<void>((resolve) => {
			release = resolve;
		});

		const transaction = db
			.transaction(async (tx) => {
				await tx.insert(settings).values({ key: "inside", value: "1", updatedAt });
				inserted();
				await rollBack;
				throw new Error("roll back");
			})
			.then(
				() => "committed",
				(error: Error) => error.message,
			);
		await insertedInside;
		// Drizzle's queries are lazy, so `execute()` starts the write now, while the transaction is
		// open; the pause lets it reach the connection before the transaction rolls back.
		const outside = db
			.insert(settings)
			.values({ key: "outside", value: "1", updatedAt })
			.execute()
			.then(
				() => "written",
				(error: Error) => error.message,
			);
		// A fixed pause, since neither Drizzle nor Turso shows when a statement reaches the
		// connection. On a runner too slow to submit the write within it, the write lands after
		// the rollback, and the test passes on rc.4 too: it fails open, never flakes.
		await new Promise((resolve) => setTimeout(resolve, 50));
		release();

		expect(await transaction).toBe("roll back");
		expect(await outside).toBe("written");
		expect(await keys()).toEqual(["outside"]);
	});
});

describe("withoutBoundValues", () => {
	it("keeps a failed query's statement and the driver's error, never its bound values", () => {
		const cause = new Error("UNIQUE constraint failed: owner.id");
		const failure = new DrizzleQueryError(
			'insert into "owner" ("username", "password_hash") values (?, ?)',
			["harbourmaster", "$argon2id$secret"],
			cause,
		);
		const safe = withoutBoundValues(failure);
		expect(safe).toEqual({
			name: "DrizzleQueryError",
			query: 'insert into "owner" ("username", "password_hash") values (?, ?)',
			cause,
		});
		expect(JSON.stringify(safe)).not.toContain("harbourmaster");
	});

	it("passes any other error through", () => {
		const other = new Error("disk full");
		expect(withoutBoundValues(other)).toBe(other);
	});
});

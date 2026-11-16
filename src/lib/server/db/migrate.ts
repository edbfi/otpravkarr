import { migrate } from "drizzle-orm/tursodatabase/wasm-migrator";
import type { Database } from "./client.ts";

// Vite bundles every reviewed migration's SQL, so the built server needs no `drizzle/` folder.
const files = import.meta.glob<string>("/drizzle/*/migration.sql", {
	query: "?raw",
	import: "default",
	eager: true,
});

/** The migrations keyed by their folder's name, which Drizzle records as each one's name. */
export const migrations: Record<string, string> = Object.fromEntries(
	Object.entries(files).map(([path, sql]) => [path.split("/").at(-2) ?? path, sql]),
);

/**
 * A newer otpravkarr migrated the database: it records a migration this build doesn't have. The
 * message names neither the path nor the migration (SPEC-setup.md, "Migrations").
 */
export class NewerDatabaseError extends Error {
	override readonly name = "NewerDatabaseError";

	constructor() {
		super(
			"The database was migrated by a newer otpravkarr: run that version again, or restore the backup taken with this one",
		);
	}
}

/** The table Drizzle's migrator records each applied migration in. */
const TABLE = "__drizzle_migrations";

/** The names of the migrations `db` has recorded; none on a new database. */
async function recordedNames(db: Database): Promise<(string | null)[]> {
	const table = await (
		await db.$client.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
	).get(TABLE);
	if (table === undefined) return [];
	const rows = (await (await db.$client.prepare(`SELECT name FROM ${TABLE}`)).all()) as {
		name: string | null;
	}[];
	return rows.map((row) => row.name);
}

/**
 * Applies the migrations `db` hasn't recorded yet, in one transaction, and only forward: a database
 * that records a migration not in `bundled` is refused before anything is applied.
 */
export async function migrateDatabase(
	db: Database,
	bundled: Record<string, string> = migrations,
): Promise<void> {
	const known = new Set(Object.keys(bundled));
	if ((await recordedNames(db)).some((name) => name === null || !known.has(name))) {
		throw new NewerDatabaseError();
	}
	await migrate(db, { migrations: bundled });
}

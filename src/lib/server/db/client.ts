import { connect } from "@tursodatabase/database";
import { DrizzleQueryError } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";

/** Opens the database file at `path` (D6: the one connection the app uses). */
export async function openDatabase(path: string) {
	const client = await connect(path);
	return drizzle({ client });
}

export type Database = Awaited<ReturnType<typeof openDatabase>>;

/** A transaction's handle: every statement in a transaction goes through it (D6). */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** What a named operation runs on: the database, or a transaction a service opened. */
export type Executor = Database | Transaction;

/**
 * A failed query's error, safe to log. Drizzle's `DrizzleQueryError` holds the statement's bound
 * values in its message and its `params` whenever the driver passes them (Turso, with
 * `1.0.0-rc.5`, doesn't), and no redaction rule matches them (a username, a password hash), so
 * only the statement, with its placeholders, and the driver's own error are kept.
 */
export function withoutBoundValues(error: unknown): unknown {
	if (!(error instanceof DrizzleQueryError)) return error;
	return { name: error.name, query: error.query, cause: error.cause };
}

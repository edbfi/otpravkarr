import { redact } from "./redact.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogMetadata = Record<string, unknown>;
export type Logger = Record<LogLevel, (message: string, metadata?: LogMetadata) => void>;

let debug = false;

/** Sets what startup read from the configuration; debug entries are dropped until it is on. */
export function configureLogging(options: { debug: boolean }): void {
	debug = options.debug;
}

/** Entries handed to standard output whose write hasn't finished yet. */
let writing = 0;
const whenWritten: (() => void)[] = [];

function write(line: string): void {
	writing++;
	// The callback runs once the entry has left the process, or with an error; either way it no
	// longer waits.
	process.stdout.write(line, () => {
		writing--;
		if (writing === 0) for (const resolve of whenWritten.splice(0)) resolve();
	});
}

/**
 * Resolves once every entry written so far has left the process, so an entry written just before
 * the process exits isn't lost. An empty write's callback isn't enough: on Bun it can run while
 * earlier entries still wait for a slow reader.
 */
export function flushLogs(): Promise<void> {
	if (writing === 0) return Promise.resolve();
	return new Promise((resolve) => whenWritten.push(resolve));
}

/** What an entry holds for a value that can't be read or redacted. */
const UNREADABLE = "[unreadable]";

/**
 * The metadata, redacted. Logging never throws, since its callers log while handling another
 * failure: a value whose getter or `toJSON` throws, or one nested too deep to walk, becomes a
 * description that can't leak (an error's class and its cleaned message), field by field.
 */
function redactOrDescribe(metadata: LogMetadata): unknown {
	try {
		return redact(metadata);
	} catch {
		const fields: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(metadata)) {
			try {
				fields[key] = redact(value);
			} catch {
				fields[key] = summary(value);
			}
		}
		return redact(fields);
	}
}

/** An error's class and cleaned message, read defensively; anything else is unreadable. */
function summary(value: unknown): unknown {
	try {
		if (!(value instanceof Error)) return UNREADABLE;
		return { name: String(value.name), message: redact(String(value.message)) };
	} catch {
		return UNREADABLE;
	}
}

/**
 * A logger for `source`. Each entry is one JSON line on standard output (D11), redacted before
 * it is written (SPEC-setup.md, "Logging").
 */
export function createLogger(source: string): Logger {
	const entry =
		(level: LogLevel) =>
		(message: string, metadata: LogMetadata = {}): void => {
			if (level === "debug" && !debug) return;
			const line = JSON.stringify({
				time: new Date().toISOString(),
				level,
				source,
				message: redact(message),
				metadata: redactOrDescribe(metadata),
			});
			write(`${line}\n`);
		};
	return { debug: entry("debug"), info: entry("info"), warn: entry("warn"), error: entry("error") };
}

const requests = createLogger("request");

/**
 * Logs an error SvelteKit caught that the app didn't expect, as one redacted entry with the
 * method and the path, never the query string; `handleError` calls it, so SvelteKit's own
 * unredacted `console.error` never runs (SPEC-setup.md, "Logging").
 */
export function logUnexpectedError(error: unknown, method: string, url: URL): void {
	requests.error("unexpected error", { method, path: url.pathname, error });
}

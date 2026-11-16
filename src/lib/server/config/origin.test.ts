import { describe, expect, it } from "vitest";
import { ConfigError } from "./config-error.ts";
import { readOrigin } from "./origin.ts";

function failure(value: string): ConfigError {
	try {
		readOrigin({ ORIGIN: value });
	} catch (error) {
		if (error instanceof ConfigError) return error;
		throw error;
	}
	throw new Error("the origin was accepted");
}

describe("readOrigin", () => {
	it("is undefined when unset", () => {
		expect(readOrigin({})).toBeUndefined();
	});

	it("returns a bare http or https origin, with or without a trailing slash, as parsed", () => {
		expect(readOrigin({ ORIGIN: "https://otpravkarr.example" })).toBe("https://otpravkarr.example");
		expect(readOrigin({ ORIGIN: "https://otpravkarr.example/" })).toBe(
			"https://otpravkarr.example",
		);
		expect(readOrigin({ ORIGIN: "http://192.168.1.20:3000" })).toBe("http://192.168.1.20:3000");
		expect(readOrigin({ ORIGIN: "HTTPS://Otpravkarr.Example:443" })).toBe(
			"https://otpravkarr.example",
		);
	});

	// adapter-bun refuses an empty ORIGIN before `init`, so ORIGIN is exempt from the rule that
	// an empty variable counts as unset (SPEC-setup.md, "Configuration and startup checks").
	it("refuses an empty value", () => {
		expect(failure("").message).toBe(
			"ORIGIN is empty; leave it out or set it to an http or https origin",
		);
	});

	it.each([
		["https://u:p@otpravkarr.example", "ORIGIN must not hold credentials"],
		["https://u@otpravkarr.example", "ORIGIN must not hold credentials"],
		["https://@otpravkarr.example", "ORIGIN must not hold credentials"],
		["https://otpravkarr.example/app", "ORIGIN must not have a path"],
		["https://otpravkarr.example//", "ORIGIN must not have a path"],
		// The parser removes dot segments, so the raw path is checked before it.
		["https://otpravkarr.example/app/..", "ORIGIN must not have a path"],
		// The parser reads a backslash as a slash in http and https URLs.
		["https://otpravkarr.example\\app\\..", "ORIGIN must not have a path"],
		["https://otpravkarr.example\\..", "ORIGIN must not have a path"],
		["https://otpravkarr.example/%2e", "ORIGIN must not have a path"],
		["https://otpravkarr.example/.", "ORIGIN must not have a path"],
		["https://otpravkarr.example/?x=1", "ORIGIN must not have a query"],
		["https://otpravkarr.example?", "ORIGIN must not have a query"],
		["https://otpravkarr.example/#top", "ORIGIN must not have a fragment"],
		["ftp://otpravkarr.example", "ORIGIN must use http or https"],
		[
			"otpravkarr.example",
			"ORIGIN is not a URL; set it to an origin such as https://otpravkarr.example",
		],
	])("refuses %s, naming the problem but not the value", (value, message) => {
		const error = failure(value);
		expect(error.variable).toBe("ORIGIN");
		expect(error.message).toBe(message);
	});
});

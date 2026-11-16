import { error, fail, redirect } from "@sveltejs/kit";
import { TOKEN_LIFETIME_MS } from "#lib/server/security/bootstrap-token.ts";
import { PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX } from "#lib/server/security/password.ts";
import { type ClaimResult, claimInstance } from "#lib/server/services/setup/claim.ts";
import { isFirstRunComplete } from "#lib/server/services/setup/first-run.ts";
import { currentDatabase } from "#lib/server/services/setup/startup.ts";
import type { Actions, PageServerLoad } from "./$types";

type Invalid = Extract<ClaimResult, { status: "invalid" }>;

/** What a failed claim sends back: the typed username and what went wrong, nothing else. */
type ClaimFailure = {
	username: string;
	usernameError?: Invalid["username"];
	passwordError?: Invalid["password"];
	tokenRefused?: boolean;
	failed?: boolean;
};

// The claim is first run's first step; once first run is complete it no longer exists (D27).
export const load: PageServerLoad = () => {
	if (isFirstRunComplete()) error(404);
	// The numbers the page states come from the constants the checks use (SPEC-i18n.md).
	return {
		limits: {
			usernameMax: USERNAME_MAX,
			passwordMin: PASSWORD_MIN,
			passwordMax: PASSWORD_MAX,
			tokenMinutes: Math.round(TOKEN_LIFETIME_MS / 60_000),
		},
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		// Form fields are external input: anything but text counts as empty.
		const field = (name: string) => {
			const value = form.get(name);
			return typeof value === "string" ? value : "";
		};
		const username = field("username");
		const result = await claimInstance(currentDatabase(), {
			token: field("token"),
			username,
			password: field("password"),
		});
		// A failed claim sends back only the typed username: never the token or the password.
		const failure = (status: number, problem: Omit<ClaimFailure, "username">) =>
			fail<ClaimFailure>(status, { username, ...problem });
		switch (result.status) {
			case "claimed":
				return redirect(303, "/");
			case "not-found":
				return error(404);
			case "invalid":
				return failure(400, { usernameError: result.username, passwordError: result.password });
			case "token":
				return failure(400, { tokenRefused: true });
			case "failed":
				return failure(500, { failed: true });
		}
	},
};

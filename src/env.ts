import { defineEnvVars } from "@sveltejs/kit/env";

// SvelteKit 3 exposes only the private variables declared here (through
// $lib/server/private-env). Validation stays in the readers; unset values
// remain undefined so the existing defaults apply.
const optional = { schema: (value: string | undefined) => value };

export const variables = defineEnvVars({
  DATABASE_PATH: optional,
  HOST: optional,
  IDLE_TIMEOUT: optional,
  NODE_ENV: optional,
  ORIGIN: optional,
  OTPRAVKARR_SECRET: optional,
  PORT: optional,
});

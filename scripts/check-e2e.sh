#!/usr/bin/env bash
set -euo pipefail
bun run build
# Require the runtime migration copy, with exactly the same SQL bytes as source.
test -f build/index.js
diff -r src/lib/db/migrations build/server/migrations
# Each invocation seeds and launches its own fresh database and server, in a temporary
# directory it deletes on exit (also on failure or interrupt). Normal exits and Ctrl-C
# let Playwright stop the server first; a SIGTERM to the whole process group orphans
# Playwright's server (it doesn't stop it), which then keeps its deleted database open.
run_e2e() (
  dir="$(mktemp -d "${TMPDIR:-/tmp}/otpravkarr-e2e-XXXXXX")"
  trap 'rm -rf "$dir"' EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
  E2E_DATABASE_PATH="$dir/test.sqlite" E2E_SKIP_BUILD=1 E2E_SEED_SETUP_PRE_ADMIN="$1" \
    bunx --no-install playwright test
)
run_e2e 0
run_e2e 1

# CI and Renovate

Every pull request and default-branch push runs Biome, TypeScript and warning-free
Svelte checks, the full Vitest suite, production/browser checks, and prek hygiene.
`ci / required` requires exactly these jobs; missing, skipped, cancelled or
failed jobs block merging. No path filters remove required CI.

Use Bun 1.4.2 and `bun install --frozen-lockfile`, then `bun run check`,
`bun run check:types`, `bun run test`, and `bun run test:e2e`. The type script aligns
CI and prek and prepares generated SvelteKit types first. Frozen installation now
propagates preparation failures. The application remains Bun/SQLite; Node is used
only by test/tool CLIs. CI installs the lockfile's Playwright Chromium on the configured Ubuntu runner.

The E2E command builds once, verifies the exact migration directory shipped in
`build/server/migrations`, and boots two successive real production servers on
separate disposable SQLite databases. The ordinary admin/portal tests and fresh
setup test both run; neither mode silently skips the other. Tests have one worker
because they share state and authentication rate limits. No retries hide failures.
The fresh setup mode seeds only the claimed wizard and tests creation of the first
admin. The full live Plex/Dispatcharr connection wizard remains outside this suite.
Failure reports are retained for seven days.

Shared workflows and actions come from immutable full version tags. Permissions
are read-only, jobs have timeouts, superseded runs cancel, and dependency caches
include the lockfile/runtime/runner architecture. Prek's formatting/types hooks are
covered by their dedicated read-only CI checks, while hygiene and secret detection
remain separate. Source and lockfile mutation fails validation.

Renovate uses the immutable v4.0.0 default preset, including grouped non-major
updates, hook discovery and the official Biome version manager. Automerge stays
off for this repository: it does not extend the shared `automerge.json` preset,
so Renovate never arms GitHub auto-merge. The legacy Actions merger and its
maintainer commands are retired; no replacement merger is added.
All application checks remain mandatory, including warning-free Svelte/TypeScript,
production browser tests and the existing source assertions.

The separate read-only `policy / ci / policy` check validates Conventional Commit
titles, matching author sign-offs, authentic Renovate provenance, outstanding review
requests, objections and hold labels. PR metadata and review events refresh it without
cancelling other evaluations. After a pass, policy re-runs the other event's older
failed verdict for the same head, which needs `actions: write`. Protection requires
this policy context and `ci / required` from GitHub Actions on an up-to-date branch.
Renovate arms GitHub auto-merge through the shared `automerge.json` preset (rebase),
so a dependency PR merges only after every required check passes. Shared automation
configuration updates remain manual.

Biome migrations compute without write privileges using the exact isolated official
formatter. A separate App publisher writes only allowlisted source/config changes; its
push starts the normal `pull_request` CI and policy runs on the repaired commit, and
nothing is dispatched. Large repairs need manual handling. Every repaired head still
needs complete application and policy checks; a token-suppressed policy event must be
recovered through a supported App/Renovate update, not bypassed.

The suite uses local fake credentials and loopback service addresses. Real
Plex/Dispatcharr behavior, image packaging in the separate repository, and deployment
hosting remain explicit integration gaps. No helper-dispatched deployment exists in
this repository; normal default-branch push CI remains unchanged.

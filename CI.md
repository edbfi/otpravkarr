# CI and Renovate

Every pull request and default-branch push runs Biome, TypeScript and warning-free
Svelte checks, the full Vitest suite, production/browser checks, and prek hygiene.
`ci / required` requires exactly these jobs plus the dispatch guard; missing,
skipped, cancelled or failed jobs block merging. No path filters remove required CI.

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

Renovate uses the immutable v3.0.1 default preset, including grouped non-major
updates, hook discovery and the official Biome version manager. Native PR merging
is explicitly disabled for this repository. The legacy Actions merger and its
maintainer commands are retired by this migration; no replacement merger is added.
All application checks remain mandatory, including warning-free Svelte/TypeScript,
production browser tests and the existing source assertions.

The separate read-only `policy / ci / policy` check validates Conventional Commit
titles, matching author sign-offs, authentic Renovate provenance, outstanding review
requests, objections and hold labels. PR metadata and review events refresh it without
cancelling other evaluations. Before any later opt-in, protection must require this
policy context and `ci / required` from GitHub Actions, current branches and existing
review restrictions. Shared automation configuration updates remain manual.

This is a prepared migration while the default branch remains locked and the legacy
merge workflow remains disabled. The historical queued helper run is not treated as
quiescent merely because its workflow is disabled. Resolve that integration blocker
and verify effective protection before merging the migration or enabling automerge.
A successful PR CI run alone does not authorize either change.

Biome migrations compute without write privileges using the exact isolated official
formatter. A separate App publisher writes only allowlisted source/config changes
and dispatches full CI for the exact repaired SHA. Existing recovery settings move
to `.github/repair-policy.json` with the released v3.0.1 reference. They retain their
current enabled state, source allowlist and standalone root Bun lock. Recovery can
dispatch CI but cannot merge, push or manufacture checks. Large repairs need manual
handling. Every repaired head still needs complete application and policy checks;
a token-suppressed policy event must be recovered through a supported App/Renovate
update, not bypassed.

The suite uses local fake credentials and loopback service addresses. Real
Plex/Dispatcharr behavior, image packaging in the separate repository, and deployment
hosting remain explicit integration gaps. No helper-dispatched deployment exists in
this repository; normal default-branch push CI remains unchanged.

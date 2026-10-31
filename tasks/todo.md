# Tasks: `secrets`

The spec is [docs/SPEC-secrets.md](../docs/SPEC-secrets.md), and the plan is [plan.md](plan.md).
One PR, branch `feat/secrets`, title `feat(secrets): encrypt stored secrets, ported from obzorarr`.

- [ ] **1. Copy** these 14 paths from obzorarr `b9b4737` with the plan's renames:
  `playwright.config.ts`, `src/env.ts`, `src/hooks.server.ts`,
  `src/lib/server/config/secret-key{,.test}.ts`,
  `src/lib/server/security/secrets/{key-text,keyring,secret,cipher}{,.test}.ts`,
  `tests/e2e/secret-key.test.ts`. `keyring-test-` (the keyring test's temp prefix) stays as is. If
  a leak test fails only because a renamed temp-folder prefix (`otpravkarr-secret-key-`,
  `otpravkarr-e2e-`) shares 6 characters with what it checks, use a prefix without the app name
  and declare it.
- [ ] **2. Prove the copy.** For each path, `diff` of obzorarr's file through the renames against
  ours prints nothing beyond the declared exceptions, and
  `git diff --stat origin/main -- src tests playwright.config.ts` lists only the 14 paths. The
  command and its output go in the PR body.
- [ ] **3. Close the stream** as obzorarr#283's last commit did: README's "Master key" section with
  otpravkarr's names and backup text (D16); AGENTS.md's status and structure; `secrets` built in
  `docs/SPEC.md`; `docs/SPEC-secrets.md` cut to what code and tests can't say, its Status pointing
  to this app's pre-cut commit, with the preservation table in the PR body; `docs/decisions.md`
  only if the cut leaves a durable outcome without a home; delete `tasks/`. `legacy-spec.md` stays
  untouched: its retirement is a separate work stream (the owner's instruction, quoted in the PR
  body).
- [ ] **4. Gates.** Before each commit: `check`, `test`, `lint` and
  `prek run --all-files --hook-stage manual`; before pushing: a keyless `build` and `smoke`.
  Manually, the built server with no key exits 1 before listening and prints the fix naming
  Otpravkarr.
- [ ] **5. PR body:** the reference and its commit, the copy proof, the declared exceptions, the
  preservation table, the checks and the review outcome.
- [ ] **6. Review:** `babysit-pr` until Ready, then squash-merge and clean up.

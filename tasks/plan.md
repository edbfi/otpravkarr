# Implementation plan: `secrets`

## Overview

Build module 1 of the capability map as [docs/SPEC-secrets.md](../docs/SPEC-secrets.md) specifies,
by copying obzorarr's built `secrets` (the reference, `main` at `b9b4737`, edbfi/obzorarr#283) in
one PR rather than writing it again from the spec. The steps are in [todo.md](todo.md).

## Architecture decisions

- **Copy, don't re-implement.** obzorarr's code and tests already meet this spec, which matches
  obzorarr's pre-cut copy (`eab36fd`) apart from the app's own names and decisions. A copy keeps
  the apps the same (AGENTS.md, Shared groundwork) and its proof is mechanical.
- **One PR, two commits.** `feat(secrets): port obzorarr's secrets code and tests`, then
  `docs(secrets): close the secrets work stream`. The library and its tests are most of the lines,
  so a separate library PR wouldn't shrink the review and would leave unwired code on `main`.
- **Exact renames only:** `OBZORARR`→`OTPRAVKARR`, `Obzorarr`→`Otpravkarr`,
  `obzorarr`→`otpravkarr`. Any other difference is declared in the PR body with its reason.
- **A bug found in the copy is fixed in obzorarr first**, in its own PR, then ported; the apps
  never drift. A review finding that reopens a point obzorarr settled is rejected, citing the
  obzorarr PR.

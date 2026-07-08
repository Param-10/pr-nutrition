# PR Nutrition evaluation corpus

This directory contains deterministic evaluation cases for PR Nutrition's rule behavior.

The eval suite is not a product feature. It is measurement infrastructure for false positives, false negatives, noisy review focus, and rule regressions before adding config support or richer detectors.

Run it with:

```bash
pnpm eval
```

To keep the generated temporary repositories for debugging:

```bash
PR_NUTRITION_KEEP_EVAL=1 pnpm eval
```

## Layout

```text
eval/
  cases/       fixture builders for temporary Git repositories
  expected/    structured assertions for each case
  run-eval.mjs evaluation runner
```

Each case creates a temporary Git repository under the operating-system temp directory, commits a base state, commits a head state, and runs the current core analyzer from `HEAD~1` to `HEAD`.

Expected files assert on structured JSON fields instead of full Markdown snapshots, so wording-only renderer changes do not make the corpus brittle.

## Current cases

- `docs-only`: documentation-only changes should stay low-risk and avoid production-change guidance.
- `lockfile-only`: lockfile changes should be low-review-value while still surfacing dependency review.
- `generated-client`: generated output should not inflate reviewable lines.
- `auth-real`: real auth/session changes should surface authentication risk and focus.
- `auth-false-positive`: auth-looking prose/test paths should not become authentication risk.
- `migration-real`: migration files should surface migration risk and focus.
- `ci-only`: workflow changes should classify as CI, not generic configuration.
- `rename-only`: pure renames should preserve rename metadata without inflating line counts.
- `binary-only`: binary assets should be handled safely and treated as low-review-value.
- `monorepo-package`: nested package manifests should classify as dependency changes, not generic configuration. The current baseline also records API area for `packages/api/package.json`; keep that visible until classifier priority is refined.
- `custom-generated`: configured generated paths should stay low-review-value.
- `custom-auth-path`: configured auth paths should surface authentication risk.
- `custom-docs-path`: configured documentation paths should count as docs without production-change guidance.
- `author-component-false-positive`: author-related source paths should not become authentication risk.
- `design-token-false-positive`: design token paths should not become authentication risk.
- `api-docs-false-positive`: API documentation should stay docs, not API contract risk.
- `migration-docs-false-positive`: migration documentation should stay docs, not database migration risk.
- `config-docs-false-positive`: configuration documentation should stay docs, not configuration risk.
- `generated-auth-client-false-positive`: generated auth/API-looking clients should stay skim/generated.
- `risky-word-fixtures-false-positive`: test fixtures with auth/API/migration/config names should stay test-like.
- `github-issue-template-false-positive`: issue templates should not become CI/workflow risk.
- `package-docs-false-positive`: package-manager docs should not become dependency risk.
- `release-notes-false-positive`: changelog and release docs should stay documentation-only.

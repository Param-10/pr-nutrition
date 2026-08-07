# Architecture

PR Nutrition follows a deterministic local pipeline:

```text
Git metadata
  -> file classification
  -> repository evidence
  -> risk scoring
  -> AnalysisResult
  -> Markdown/JSON renderers
  -> CLI or read-only GitHub Action
```

## Package Boundaries

- `packages/core`: Owns the analysis engine and renderers. Contains no GitHub Action or CLI parsing logic.
- `packages/cli`: Only handles arguments, output writing, and exit codes. Uses `packages/core`.
- `packages/action`: A read-only GitHub Action wrapper around the core, without changing the core model or calling GitHub APIs.

## Stable Core Boundary

`analyzePullRequest()` returns a versioned `AnalysisResult`. Changed areas are an ordered array with an identifier, label, and matching file paths. Risk reasons, review focus, explanations, and focus-file groups follow fixed deterministic order. `renderMarkdown()` and `renderJson()` are pure transformations of that result.

The core invokes Git directly, without a shell, and requests metadata only. Strict config validation, deterministic path classification, and doctor diagnostics stay local. GitHub API access, AST parsing, hosted services, and LLM services are outside the current trusted core boundary.

## Path Classification Precision

Risk-area rules only have file paths to work with, so they must prefer precision over recall. A rule that fires on an ordinary file costs more trust than a rule that misses an unusual one, and teams can always add their own paths through `.pr-nutrition.json`.

Two constraints follow from that:

- Match whole path segments or whole filename stems, never substrings. `LoginButton.tsx` is a component; `login.ts` is authentication logic.
- Never classify by generic file extension. Most `.json` and `.yaml` files in a repository are fixtures, locales, or static data rather than configuration.

Every risk-area rule needs an eval case for the paths it should match and the near-miss paths it must not. Expectations belong in `eval/expected` and should be written from intent, not copied from current output, so the corpus measures correctness rather than pinning today's behavior.

## Risk Scoring

An area contributes points once, no matter how many files matched it. Most areas scale those points across three bands, so a trivial touch and a substantial rewrite are not equivalent:

- `light`: one file and at most 10 reviewable lines
- `moderate`: up to 3 files and up to 60 reviewable lines
- `full`: anything larger

Bands use reviewable lines, so generated files and lockfiles contribute zero regardless of their diff size.

Migrations and authentication opt out of banding and always score full points. There the existence of the change is the signal rather than its size: a one-line migration can drop a table, and a two-line auth change can invert a permission check. An area opts into banding by declaring `magnitudePoints` in `RISK_AREAS`.

## GitHub Action Boundary

`packages/action` owns only runner-specific behavior:

- reading Action inputs
- reading pull-request base/head SHAs from the GitHub event payload
- requiring callers to provide full history with `actions/checkout` and `fetch-depth: 0`
- writing Markdown and JSON report files
- appending Markdown to `$GITHUB_STEP_SUMMARY`
- setting Action outputs

The Action does not fetch Git history, call GitHub APIs, post comments, mutate pull requests, or add write-permission requirements. It should remain a distribution wrapper for the same deterministic core report, not a separate review platform.

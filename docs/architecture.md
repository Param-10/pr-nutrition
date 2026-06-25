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

`analyzePullRequest()` returns a versioned `AnalysisResult`. Changed areas are an ordered array with an identifier, label, and matching file paths. Risk reasons and review focus follow a fixed priority order, and focus is capped at five items. `renderMarkdown()` and `renderJson()` are pure transformations of that result.

The core invokes Git directly, without a shell, and requests metadata only. GitHub API access, configuration parsing, AST parsing, and hosted or LLM services are outside the current trusted core boundary.

## GitHub Action Boundary

`packages/action` owns only runner-specific behavior:

- reading Action inputs
- reading pull-request base/head SHAs from the GitHub event payload
- requiring callers to provide full history with `actions/checkout` and `fetch-depth: 0`
- writing Markdown and JSON report files
- appending Markdown to `$GITHUB_STEP_SUMMARY`
- setting Action outputs

The Action does not fetch Git history, call GitHub APIs, post comments, mutate pull requests, or add write-permission requirements. It should remain a distribution wrapper for the same deterministic core report, not a separate review platform.

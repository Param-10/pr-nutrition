# Architecture

PR Nutrition follows a deterministic local pipeline:

```text
Git metadata
  -> file classification
  -> repository evidence
  -> risk scoring
  -> AnalysisResult
  -> Markdown/JSON renderers
  -> CLI
```

## Package Boundaries

- `packages/core`: Owns the analysis engine and renderers. Contains no GitHub Action or CLI parsing logic.
- `packages/cli`: Only handles arguments, output writing, and exit codes. Uses `packages/core`.
- `packages/action`: A read-only GitHub Action wrapper around the core, without changing the core model or calling GitHub APIs.

## Stable Core Boundary

`analyzePullRequest()` returns a versioned `AnalysisResult`. Changed areas are an ordered array with an identifier, label, and matching file paths. Risk reasons and review focus follow a fixed priority order, and focus is capped at five items. `renderMarkdown()` and `renderJson()` are pure transformations of that result.

The core invokes Git directly, without a shell, and requests metadata only. GitHub API access, configuration parsing, AST parsing, and hosted or LLM services are outside the v0.1 boundary.

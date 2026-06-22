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
- `packages/action`: (Future) A GitHub Action wrapper around the CLI/core, without changing the core model.

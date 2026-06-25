# Changelog

All notable changes to PR Nutrition are documented in this file.

## Unreleased

### Added

- Read-only GitHub Action wrapper that runs the deterministic core without GitHub API calls or pull request mutation.
- Action Markdown step summaries, Markdown/JSON report files, and outputs for `risk-score`, `risk-level`, `files-changed`, `markdown-path`, and `json-path`.
- Reproducible committed Node 24 Action bundle with a bundle-diff check.
- PR-only CI dogfood job that runs the committed Action through `uses: ./` without installing dependencies.

### Security

- The Action requires caller-provided full Git history and does not fetch missing history automatically.
- The Action keeps `contents: read` compatibility and does not require write permissions, PR comments, GitHub API usage, LLM calls, or network access during analysis.
- The Action dependency boundary remains limited to exact-pinned `@actions/core@3.0.1` and the committed bundle.

## 0.1.0 - 2026-06-23

### Added

- Deterministic three-dot pull-request analysis using Git metadata only.
- Stable Markdown and JSON reports for scope, risk, evidence, low-review-value files, and review focus.
- Risk classification for migrations, authentication and security, CI workflows, public contracts, dependencies, and configuration.
- Generated, binary, rename, unusual-filename, test, documentation, and repository-evidence handling.
- The `pr-nutrition` CLI with Markdown/JSON formats, output files, stable exit codes, and Node 22–26 support.
- Golden fixtures, temporary-repository integration coverage, dogfood examples, and offline packed-CLI verification.

### Security

- The analyzer never requests patch contents, reads `.env` values, executes repository scripts, or calls external services.
- Git revisions and output paths are handled without a shell, manifest symlinks are not followed, and Markdown paths escape terminal control characters.
- CI actions are pinned to immutable commits and checkout credentials are not persisted.

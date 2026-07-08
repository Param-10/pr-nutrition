# Changelog

All notable changes to PR Nutrition are documented in this file.

## Unreleased

### Fixed

- Reduced noisy risk classifications for docs and test fixture paths containing risky-looking words.

## 0.2.0 - Unreleased

### Added

- Read-only GitHub Action.
- Strict `.pr-nutrition.json` configuration.
- `--json` shortcut for JSON output.
- `--explain` with deterministic rule IDs.
- `--focus-files` to group review-first, normal-review, and skim files.
- `pr-nutrition doctor` for local setup diagnostics.
- False-positive evaluation corpus.
- Action dogfood workflow.
- Bundle reproducibility checks.

### Changed

- Improved CLI quickstart and agent/script documentation.
- Improved local-first positioning and privacy documentation.
- Hardened package-manager invocation in scripts.

### Security

- Kept Action read-only with no GitHub API calls or PR mutation.
- Kept analysis metadata-only: no patch contents, source contents, `.env` values, or repo script execution.
- Preserved dependency-free packed CLI verification.
- Kept the Action dependency boundary limited to exact-pinned `@actions/core@3.0.1` and the committed bundle.

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

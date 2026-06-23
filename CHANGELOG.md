# Changelog

All notable changes to PR Nutrition are documented in this file.

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

# Changelog

All notable changes to PR Nutrition are documented in this file.

## 0.3.0 - 2026-08-09

### Added

- Markdown focus-file groups are capped at 10 entries per group with an `...and N more` line; JSON still returns the full lists.
- Eval precision reporting: every case has an `intent`, and `pnpm eval` prints false-positive avoidance and true-positive pass rates.
- Broader dependency manifests for Python, Ruby, Java/Gradle, and PHP (`requirements.txt`, `Gemfile`, `pom.xml`, `build.gradle`, `composer.json`, and related lockfiles).
- Shallow monorepo evidence discovery under `packages/*`, `apps/*`, `libs/*`, and `services/*`.
- Always-on Coverage section in Markdown and JSON describing what was checked and what was not.
- `pr-nutrition check` for pre-PR local analysis with focus-file groups enabled by default.
- Opt-in `--fail-on <low|medium|high>` on the main command and `check` (exit code `3` when the threshold is met).

### Changed

- CI risk is presence-based at full points (20), matching migrations and authentication.
- CLI `--version` reads the published package version from `package.json` instead of a hardcoded string.
- Focus-file sorting precomputes reviewable line counts instead of scanning the file list on every comparison.

## 0.2.1 - 2026-08-06

### Fixed

- Reduced noisy risk classifications for docs and test fixture paths containing risky-looking words such as `api`, `migration`, `config`, and `token`.
- Stopped treating every `.json`, `.yml`, and `.yaml` file as configuration risk. Locale files, static data, and test fixtures are no longer scored, and configuration risk now requires a known configuration or infrastructure path.
- Authentication risk now requires an auth path segment or an auth filename, so ordinary files such as `LoginButton.tsx` and `UserRolesTable.tsx` are no longer scored as authentication changes.
- API contract risk no longer fires on internal `types/` and `interfaces/` directories, and instead recognizes contract artifacts such as OpenAPI, AsyncAPI, Protobuf, and GraphQL schema files.
- GitHub issue and pull-request templates are no longer classified as risky configuration.

### Changed

- Risk scoring now scales CI, API, dependency, and configuration points with how much changed in that area, so a one-line lockfile bump no longer scores the same as a dependency overhaul. Migrations and authentication remain presence-based, because any change in those areas warrants review regardless of size.
- Risk reasons for scaled areas now report the file and line counts behind the score.
- Expanded the false-positive evaluation corpus from 13 to 23 cases.
- Corrected the `github-issue-template-false-positive` eval expectation, which asserted the false positive it was meant to prevent.
- Raised the Vitest timeout so the Git-backed test suite no longer fails intermittently against the 5s default.

## 0.2.0 - 2026-07-07

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

# pr-nutrition CLI

A local-first PR triage CLI that generates deterministic pull request review-readiness labels.

## Installation

```bash
npx pr-nutrition
npx pr-nutrition --output pr-nutrition.md
```

Or install it globally:

```bash
npm install -g pr-nutrition
pr-nutrition
```

Current pinned `0.1.0` usage:

```bash
npx pr-nutrition@0.1.0
npx pr-nutrition@0.1.0 --format json
```

The next release is `v0.2.0`. After `v0.2.0` is published:

```bash
npx pr-nutrition@0.2.0
npx pr-nutrition@0.2.0 --json
npx pr-nutrition@0.2.0 doctor
```

## Usage

```bash
pr-nutrition
pr-nutrition --json
pr-nutrition --format json
pr-nutrition --output pr-nutrition.md
pr-nutrition --base origin/main --head HEAD
pr-nutrition --config .pr-nutrition.json
pr-nutrition --no-config
pr-nutrition --explain
pr-nutrition --json --explain
pr-nutrition --focus-files
pr-nutrition --json --focus-files
pr-nutrition doctor
pr-nutrition doctor --json
pr-nutrition doctor --base main --head HEAD
pr-nutrition doctor --config .pr-nutrition.json
pr-nutrition doctor --no-config
```

```text
pr-nutrition
  --repo <path>                 default: .
  --base <ref>                  default: main
  --head <ref>                  default: HEAD
  --format <markdown|json>      default: markdown
  --json                        alias for --format json
  --output <file>
  --config <path>               default: .pr-nutrition.json
  --no-config                   disable config loading
  --explain                     add classification explanations
  --focus-files                 add file review priority groups
  --help
  --version

pr-nutrition doctor
  --repo <path>                 default: .
  --base <ref>                  default: main
  --head <ref>                  default: HEAD
  --json
  --config <path>               default: .pr-nutrition.json
  --no-config                   disable config loading
```

The `--json` shortcut is prepared for `v0.2.0`. With the already-published `0.1.0`, use `--format json`.

## Configuration

Configuration support is prepared for `v0.2.0`. The current published stable `0.1.0` CLI does not include config support.

The CLI automatically discovers `.pr-nutrition.json` at the repository root. Config extends built-in classification with repository-specific paths and never weakens built-in protections or changes risk scoring.

```json
{
  "schemaVersion": 1,
  "paths": {
    "generated": ["src/generated/**"],
    "lowReviewValue": ["snapshots/**"],
    "tests": ["spec/**"],
    "docs": ["handbook/**"],
    "risk": {
      "authentication": ["modules/identity/**"],
      "api": ["contracts/**"]
    }
  }
}
```

Patterns are POSIX-style globs matched against repo-relative paths. Validation is strict: unknown keys, invalid globs, parent traversal, symlinked config files, files over 64 KiB, and paths outside the repository are rejected. `--config` and `--no-config` cannot be combined (exit `1`); an invalid config exits `2`.

## Explanation

Explain output is prepared for `v0.2.0`. The current published stable `0.1.0` CLI does not include `--explain`.

`--explain` reports why each file was classified. Default output is unchanged unless `--explain` is passed.

- Markdown adds a compact `## Explanation` section (first 30 entries, then `...and N more`).
- JSON adds an `explanations` array with every explanation.
- Each entry has a stable `ruleId`, a `source` of `builtin`, `config`, or `git`, and a repo-relative `path`. Risk-area entries also include `area`; config entries include the matched `pattern`.
- Explanations never include file contents, patch contents, absolute paths, or environment values, and are sorted deterministically.

Built-in rule IDs: `builtin.path.<risk-area>`, `builtin.path.generated`, `builtin.path.low-review-value`, `builtin.path.test`, `builtin.path.docs`, `builtin.git.binary`, `builtin.git.rename`, `builtin.git.copy`, `builtin.git.generated`. Config rule IDs: `config.paths.generated`, `config.paths.lowReviewValue`, `config.paths.tests`, `config.paths.docs`, `config.paths.risk.<area>`.

## Focus files

Focus file output is prepared for `v0.2.0`. The current published stable `0.1.0` CLI does not include `--focus-files`.

`--focus-files` adds deterministic file review groups: `Review first`, `Review normally`, and `Skim / low-review-value`. It works with Markdown, `--json`, `--format json`, and `--explain`.

Default output is unchanged unless `--focus-files` is passed. The focus data uses existing classifications and never includes file contents, patch contents, absolute paths, or environment values.

## Doctor

Doctor output is prepared for `v0.2.0`. The current published stable `0.1.0` CLI does not include `doctor`.

`pr-nutrition doctor` checks local setup before analysis: Git repository detection, base/head refs, merge-base availability, config validity, shallow repository status, package manager evidence, test/typecheck scripts, and CI workflow filenames.

It supports `--json`, `--base`, `--head`, `--config`, and `--no-config`. Doctor never fetches history, calls GitHub APIs, reads patches, inspects `.env` contents, executes package scripts, or reads workflow contents.

## Output Formats

- `markdown`: A readable summary of the PR risk profile and context.
- `json`: A deterministic machine-readable output for integrations.

## For agents and scripts

- Markdown is the default human-readable output.
- JSON output is available with `--json` or `--format json`.
- JSON is written only to stdout unless `--output` is provided.
- Errors are written to stderr.
- Exit codes are stable: `0` success, `1` invalid CLI usage, `2` repository, ref, Git, or output failure.
- JSON includes `schemaVersion: 1`.

The command performs local, metadata-only Git analysis. It does not read patches, inspect `.env` contents, execute repository scripts, or make network calls.

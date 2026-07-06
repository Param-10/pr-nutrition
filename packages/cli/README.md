# pr-nutrition CLI

A deterministic pull request review-readiness label generator.

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

In the next release, `--json` is also available as a shortcut for `--format json`.

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
  --help
  --version
```

The `--json` shortcut is unreleased until the next npm package version is published. With the already-published `0.1.0`, use `--format json`.

## Configuration

Configuration support is available on `main` and planned for the next npm release. The current stable `0.1.0` CLI does not include config support.

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

Explain output is available on `main` and planned for the next npm release. The current stable `0.1.0` CLI does not include `--explain`.

`--explain` reports why each file was classified. Default output is unchanged unless `--explain` is passed.

- Markdown adds a compact `## Explanation` section (first 30 entries, then `...and N more`).
- JSON adds an `explanations` array with every explanation.
- Each entry has a stable `ruleId`, a `source` of `builtin`, `config`, or `git`, and a repo-relative `path`. Risk-area entries also include `area`; config entries include the matched `pattern`.
- Explanations never include file contents, patch contents, absolute paths, or environment values, and are sorted deterministically.

Built-in rule IDs: `builtin.path.<risk-area>`, `builtin.path.generated`, `builtin.path.low-review-value`, `builtin.path.test`, `builtin.path.docs`, `builtin.git.binary`, `builtin.git.rename`, `builtin.git.copy`, `builtin.git.generated`. Config rule IDs: `config.paths.generated`, `config.paths.lowReviewValue`, `config.paths.tests`, `config.paths.docs`, `config.paths.risk.<area>`.

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

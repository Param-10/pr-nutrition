# pr-nutrition CLI

A deterministic pull request review-readiness label generator.

## Installation

```bash
npx pr-nutrition@latest
npx pr-nutrition@latest --output pr-nutrition.md
```

After the next package release, the JSON shortcut will also be available:

```bash
npx pr-nutrition@latest --json
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

## Usage

```bash
pr-nutrition
pr-nutrition --json
pr-nutrition --format json
pr-nutrition --output pr-nutrition.md
pr-nutrition --base origin/main --head HEAD
```

```text
pr-nutrition
  --repo <path>                 default: .
  --base <ref>                  default: main
  --head <ref>                  default: HEAD
  --format <markdown|json>      default: markdown
  --json                        alias for --format json
  --output <file>
  --help
  --version
```

The `--json` shortcut is unreleased until the next npm package version is published. With the already-published `0.1.0`, use `--format json`.

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

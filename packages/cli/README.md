# pr-nutrition CLI

A deterministic pull request review-readiness label generator.

## Installation

```bash
npx pr-nutrition@0.1.0 --base main --head HEAD
```

Or install it globally:

```bash
npm install -g pr-nutrition
pr-nutrition --base main --head HEAD
```

## Usage

```text
pr-nutrition
  --repo <path>                 default: .
  --base <ref>                  default: main
  --head <ref>                  default: HEAD
  --format <markdown|json>      default: markdown
  --output <file>
  --help
  --version
```

## Output Formats

- `markdown`: A readable summary of the PR risk profile and context.
- `json`: A deterministic machine-readable output for integrations.

The command performs local, metadata-only Git analysis. It does not read patches, inspect `.env` contents, execute repository scripts, or make network calls.

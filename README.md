# PR Nutrition

PR Nutrition is a local-first PR triage CLI.

It gives every pull request a simple review-readiness label.

AI coding tools are making it easier than ever to generate code, open PRs, and ship changes quickly. That is useful, but it also creates a new problem: reviewers now have to read through more changes, more often, with less context.

PR Nutrition helps with that.

It does not review your code for you. It does not guess whether the code is correct. It gives you a fast, deterministic label that answers:

* What changed?
* What looks risky?
* What can probably be skimmed?
* Where should a reviewer focus first?

```bash
npx pr-nutrition@latest
```

That is it. You get a Markdown or JSON report you can read locally, save in CI, or attach to a read-only pull request workflow.

---

## Example

```text
# PR Nutrition

Risk: Medium (40/100)

Scope
- Total changes: 17 files
- Reviewable: 15 files, 320 lines
- Base: main
- Head: HEAD

Review focus
- Review dependency or package metadata changes.
- Review configuration and environment-sensitive paths.
- Docs changed; verify examples match current behavior.

Low review-value files
- pnpm-lock.yaml
- generated/client.ts
```

See the full examples:

* [Demo PR output](examples/demo-pr/pr-nutrition.md)
* [Dogfood output from this repository](examples/dogfood/pr-5.md)

---

## Why this exists

Modern development is changing.

A lot of code is now written with AI assistance. Teams can generate features, refactors, tests, and boilerplate much faster than before. But reviewers still need to understand what actually changed.

That is where PRs start becoming painful:

* Large PRs hide the important files.
* Generated files make diffs noisy.
* Lockfiles and build outputs distract from real logic.
* Risky areas like auth, migrations, workflows, and APIs need attention first.
* AI-generated changes can look polished while still being hard to trust.

PR Nutrition is built for that moment before review starts.

It gives reviewers a small “nutrition label” for the PR so they can quickly decide:

* Is this low-risk and easy to skim?
* Is this touching sensitive areas?
* Are tests or docs included?
* Are there files that should not consume review time?
* Where should I look first?

The goal is not to replace review. The goal is to make review less exhausting.

---

## What it checks

PR Nutrition uses Git metadata and file paths to classify changes.

It detects:

* PR size
* migrations
* auth and security paths
* CI and workflow changes
* API and public contract files
* dependency manifests and lockfiles
* configuration and environment-sensitive paths
* generated files
* low-review-value files
* renamed and binary files
* changed tests and docs
* repository evidence like package manager, test scripts, typecheck scripts, and CI workflow presence

Risk scores are deterministic and capped at `100`.

```text
Low:    0–19
Medium: 20–49
High:   50–100
```

Tests and docs affect the review guidance, but they do not reduce the risk score. A risky change is still risky even if tests were added.

---

## Install

Use it directly with `npx`:

```bash
npx pr-nutrition
npx pr-nutrition --output pr-nutrition.md
```

Or install globally:

```bash
npm install -g pr-nutrition
pr-nutrition
```

Current stable npm release: `pr-nutrition@0.2.0`.

```bash
npx pr-nutrition@0.2.0
npx pr-nutrition@0.2.0 --help
npx pr-nutrition@0.2.0 doctor
```

---

## CLI usage

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

Full contract:

```text
pr-nutrition [--repo <path>] [--base <ref>] [--head <ref>]
             [--format <markdown|json>] [--json] [--output <file>]
             [--config <path>] [--no-config] [--explain] [--focus-files]

pr-nutrition doctor [--repo <path>] [--base <ref>] [--head <ref>]
                    [--json] [--config <path>] [--no-config]
```

Options:

| Option                      |    Default | Description            |
| --------------------------- | ---------: | ---------------------- |
| `--repo <path>`             |        `.` | Repository to analyze  |
| `--base <ref>`              |     `main` | Base ref               |
| `--head <ref>`              |     `HEAD` | Head ref               |
| `--format <markdown\|json>` | `markdown` | Output format          |
| `--json`                    |    `false` | Alias for `--format json` |
| `--output <file>`           |     stdout | Write output to a file |
| `--config <path>`           | `.pr-nutrition.json` | Config file inside the repository |
| `--no-config`               |    `false` | Disable config loading |
| `--explain`                 |    `false` | Add deterministic classification explanations |
| `--focus-files`             |    `false` | Add deterministic file review priority groups |

The `--json` shortcut is available in the current stable `0.2.0` release.

### Configuration

Configuration support is available in the current stable `0.2.0` release.

PR Nutrition automatically looks for `.pr-nutrition.json` at the repository root. Configuration extends the built-in classification with repository-specific paths; it never weakens built-in protections, removes risk categories, hides files, or changes risk weights, thresholds, or scoring.

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

Rules:

* Patterns are POSIX-style globs matched against repo-relative paths.
* `generated`, `lowReviewValue`, `tests`, and `docs` extend the built-in path classification.
* `risk.<area>` adds paths to the built-in risk areas (`migrations`, `authentication`, `ci`, `api`, `dependencies`, `configuration`).
* Validation is strict: unknown keys, invalid globs, parent traversal, backslashes, symlinked config files, files over 64 KiB, and config paths outside the repository are rejected.
* `--config <path>` overrides discovery; `--no-config` disables config loading; combining them is invalid usage (exit `1`). Invalid config exits `2`.

### Explanation

Explain output is available in the current stable `0.2.0` release.

`--explain` adds a deterministic account of why each file was classified. It works with both Markdown and JSON output and never changes default output when it is not passed.

* Markdown gains a compact `## Explanation` section (capped at the first 30 entries, then `...and N more`).
* JSON gains an `explanations` array containing every explanation.
* Explanations use only repo-relative paths. No file contents, patch contents, absolute paths, or environment values are included.
* Explanations are sorted deterministically by path, kind, rule ID, and source.

Each explanation carries a stable `ruleId` and a `source` of `builtin`, `config`, or `git`:

| Rule ID | Meaning |
| ------- | ------- |
| `builtin.path.migrations` / `.authentication` / `.ci` / `.api` / `.dependencies` / `.configuration` | Built-in risk-area path rule |
| `builtin.path.generated` | Built-in generated-file rule |
| `builtin.path.low-review-value` | Built-in low-review-value rule |
| `builtin.path.test` / `builtin.path.docs` | Built-in test / documentation rule |
| `builtin.git.binary` / `builtin.git.rename` / `builtin.git.copy` / `builtin.git.generated` | Git-derived binary, rename, copy, and linguist-generated signals |
| `config.paths.generated` / `.lowReviewValue` / `.tests` / `.docs` | Config path classification |
| `config.paths.risk.<area>` | Config risk-area path (uses the built-in `RiskAreaId` names) |

When both a built-in and a config rule match a file's risk area, the explanation reports the winning rule under the existing deterministic priority and notes the rule it ranked above.

JSON shape with `--json --explain`:

```json
{
  "explanations": [
    {
      "path": "src/auth/session.ts",
      "kind": "risk-area",
      "area": "authentication",
      "ruleId": "builtin.path.authentication",
      "source": "builtin",
      "reason": "Path matched the built-in authentication and security rule."
    }
  ]
}
```

### Focus files

Focus file output is available in the current stable `0.2.0` release.

`--focus-files` adds a compact reviewer workflow that separates changed files into:

* `Review first`
* `Review normally`
* `Skim / low-review-value`

Markdown gains a `## Focus files` section. JSON gains a `focusFiles` array. Default output is unchanged unless `--focus-files` is passed.

The grouping uses existing deterministic classification data: risk areas, generated status, low-review-value status, binary status, and reviewable line counts. It does not read file contents, patch contents, absolute paths, or environment values.

### Doctor

Doctor output is available in the current stable `0.2.0` release.

`pr-nutrition doctor` diagnoses whether PR Nutrition can run in the current repository. It checks Git availability, worktree detection, refs, merge-base availability, config loading, shallow repository status, and safe repository evidence.

```bash
pr-nutrition doctor
pr-nutrition doctor --json
pr-nutrition doctor --base main --head HEAD
pr-nutrition doctor --config .pr-nutrition.json
pr-nutrition doctor --no-config
```

Doctor does not fetch history, call GitHub APIs, read patches, inspect `.env` contents, execute package scripts, or read workflow contents.

JSON output uses `schemaVersion: 1`, `command: "doctor"`, a top-level `status` of `ok`, `warning`, or `error`, and stable check IDs such as `git.repository`, `git.merge-base`, `config.validation`, and `evidence.package-manager`.

Exit codes:

| Code | Meaning                                 |
| ---: | --------------------------------------- |
|  `0` | Success                                 |
|  `1` | Invalid CLI usage                       |
|  `2` | Repository, ref, Git, or output failure |

PR Nutrition uses pull-request-style three-dot comparison: it finds the merge base between `base` and `head`, then analyzes changes from that merge base to `head`.

For agents and scripts:

* Markdown is the default human-readable output.
* JSON output is available with `--json` or `--format json`.
* JSON is written only to stdout unless `--output` is provided.
* Errors are written to stderr.
* Exit codes are stable:
  * `0` success
  * `1` invalid CLI usage
  * `2` repository, ref, Git, or output failure
* JSON includes `schemaVersion: 1`.

---

## GitHub Action

Current Action tag: `Param-10/pr-nutrition@v0.2.0`.

Use the released Action tag with a read-only token and full-history checkout:

```yaml
permissions:
  contents: read

steps:
  - uses: actions/checkout@v6
    with:
      fetch-depth: 0

  - id: nutrition
    uses: Param-10/pr-nutrition@v0.2.0
```

The Action is read-only, requires only `contents: read`, does not call the GitHub API, and does not post PR comments.

Inputs:

| Input | Default | Description |
| --- | --- | --- |
| `repo-path` | `.` | Repository checkout to analyze. |
| `base-ref` | Pull-request base SHA | Optional base ref. Must be provided with `head-ref`; explicit refs override event metadata. |
| `head-ref` | Pull-request head SHA | Optional head ref. Must be provided with `base-ref`; explicit refs override event metadata. |
| `write-step-summary` | `true` | Append the Markdown report to `$GITHUB_STEP_SUMMARY`. |
| `output-directory` | `$RUNNER_TEMP/pr-nutrition` | Directory for report files. |
| `use-config` | `true` | Load the repository `.pr-nutrition.json` when present. |
| `config-file` | `.pr-nutrition.json` | Config file path resolved relative to `repo-path`. |

Config example:

```yaml
with:
  use-config: true
  config-file: .pr-nutrition.json
```

Invalid config files fail the Action clearly. Config loading never adds GitHub API calls, write permissions, or PR mutation.

Outputs:

| Output | Description |
| --- | --- |
| `risk-score` | Numeric score from `0` to `100`. |
| `risk-level` | `low`, `medium`, or `high`. |
| `files-changed` | Total changed files in the analyzed range. |
| `markdown-path` | Path to `pr-nutrition.md`. |
| `json-path` | Path to `pr-nutrition.json`. |

For non-pull-request events, provide both `base-ref` and `head-ref`. Providing only one is an error. The Action writes `pr-nutrition.md` and `pr-nutrition.json` under `$RUNNER_TEMP/pr-nutrition`, appends Markdown to the job summary by default, and exposes the outputs listed above.

The Action does not fetch Git history, call GitHub APIs, create comments, or mutate pull requests. Missing history fails with guidance to use `fetch-depth: 0`.

---

## Privacy model

PR Nutrition is local-first and deterministic.

It does not:

* read patch contents
* read `.env` values
* read arbitrary source file contents for analysis
* execute repository scripts
* call GitHub APIs
* call LLMs
* upload code anywhere
* make network calls during analysis

It only uses Git metadata, file paths, selected safe repository metadata, and package/workflow presence checks.

See [Privacy Model](docs/privacy.md) for the detailed rules.

---

## What PR Nutrition is not

PR Nutrition is not:

* an AI code reviewer
* a bug detector
* a security scanner
* a PR summary bot
* a noisy PR-comment bot
* a replacement for human review
* a tool that decides whether code is correct

It is a review-readiness label.

It helps you know what kind of PR you are about to review before you spend time reading the diff.

PR Nutrition should never create work for reviewers. It should remove review noise before the review starts.

---

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm --filter pr-nutrition start -- --base main --head HEAD
```

Run checks:

```bash
pnpm test
pnpm eval
pnpm typecheck
pnpm lint
pnpm action:bundle-check
pnpm build
pnpm smoke
pnpm release:check
```

---

## Roadmap

Current:

* deterministic CLI
* Markdown and JSON output
* published npm package
* release checks
* secure staged-release automation
* read-only GitHub Action
* committed reproducible Action bundle
* strict JSON configuration
* `--json`, `--explain`, `--focus-files`, and `doctor`
* false-positive evaluation corpus

Next:

* richer deterministic framework and infrastructure rules
* optional local workflow helpers
* opt-in CI enforcement controls only after they are clearly scoped

Later:

* PR split hints
* optional PR comments only after repeated user demand
* more CI evidence
* optional LLM wording polish, never risk decisions

See [Roadmap](ROADMAP.md).

---

## Resources

* [Changelog](CHANGELOG.md)
* [Roadmap](ROADMAP.md)
* [Contributing Guidelines](CONTRIBUTING.md)
* [Security Policy](SECURITY.md)
* [Code of Conduct](CODE_OF_CONDUCT.md)
* [Architecture Notes](docs/architecture.md)
* [Privacy Model](docs/privacy.md)
* [Release Process](docs/release-process.md)

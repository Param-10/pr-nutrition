# PR Nutrition

PR Nutrition gives every pull request a simple review-readiness label.

AI coding tools are making it easier than ever to generate code, open PRs, and ship changes quickly. That is useful, but it also creates a new problem: reviewers now have to read through more changes, more often, with less context.

PR Nutrition helps with that.

It does not review your code for you. It does not guess whether the code is correct. It gives you a fast, deterministic label that answers:

* What changed?
* What looks risky?
* What can probably be skimmed?
* Where should a reviewer focus first?

```bash
npx pr-nutrition@0.1.0 --base main --head HEAD
```

That is it. You get a Markdown or JSON report you can read locally, save in CI, or attach to a pull request workflow.

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
npx pr-nutrition@0.1.0 --base main --head HEAD
```

Or install globally:

```bash
npm install -g pr-nutrition
pr-nutrition --base main --head HEAD
```

---

## CLI usage

```bash
pr-nutrition --repo . --base main --head HEAD
pr-nutrition --format json
pr-nutrition --output pr-label.md
```

Full contract:

```text
pr-nutrition [--repo <path>] [--base <ref>] [--head <ref>]
             [--format <markdown|json>] [--output <file>]
```

Options:

| Option                      |    Default | Description            |
| --------------------------- | ---------: | ---------------------- |
| `--repo <path>`             |        `.` | Repository to analyze  |
| `--base <ref>`              |     `main` | Base ref               |
| `--head <ref>`              |     `HEAD` | Head ref               |
| `--format <markdown\|json>` | `markdown` | Output format          |
| `--output <file>`           |     stdout | Write output to a file |

Exit codes:

| Code | Meaning                                 |
| ---: | --------------------------------------- |
|  `0` | Success                                 |
|  `1` | Invalid CLI usage                       |
|  `2` | Repository, ref, Git, or output failure |

PR Nutrition uses pull-request-style three-dot comparison: it finds the merge base between `base` and `head`, then analyzes changes from that merge base to `head`.

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
* a replacement for human review
* a tool that decides whether code is correct

It is a review-readiness label.

It helps you know what kind of PR you are about to review before you spend time reading the diff.

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
pnpm typecheck
pnpm lint
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

Next:

* read-only GitHub Action
* strict JSON configuration
* richer deterministic framework and infrastructure rules

Later:

* optional PR comments
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

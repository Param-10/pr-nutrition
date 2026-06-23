# PR Nutrition

PR Nutrition generates a deterministic review-readiness label for pull requests.

Not an AI code reviewer. Not a PR summary bot. A deterministic label that tells reviewers what changed, what looks risky, and where to focus.

## Status

v0.1 is available from this repository for local testing. It has not been published to npm yet.

## Installation

After v0.1.0 is published:

```bash
npx pr-nutrition@0.1.0 --base main --head HEAD
```

Until then, use the local development workflow below.

## Example Output

See [examples/demo-pr/pr-nutrition.md](examples/demo-pr/pr-nutrition.md) for a complete example of the generated Markdown label.
The [dogfood example](examples/dogfood/pr-5.md) was produced from this repository's merged documentation PR.

## Quick Start (Local Development)

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm --filter pr-nutrition start -- --base main --head HEAD
```

## CLI Usage

Until an npm release exists, run the built CLI through the workspace:

```bash
pnpm --filter pr-nutrition start -- --repo . --base main --head HEAD
pnpm --filter pr-nutrition start -- --format json
pnpm --filter pr-nutrition start -- --output pr-label.md
```

The eventual binary contract is:

```text
pr-nutrition [--repo <path>] [--base <ref>] [--head <ref>]
             [--format <markdown|json>] [--output <file>]
```

The analyzer finds the merge base and compares that commit with the head, matching pull-request three-dot semantics. Exit codes are `0` for success, `1` for invalid CLI usage, and `2` for repository, ref, Git, or output failures.

## What it Detects

PR Nutrition runs deterministically to classify and score risk based on:

- PR size (total files and reviewable lines)
- Migrations
- Auth/security paths
- CI/workflows
- API/public contracts
- Dependency manifests and lockfiles
- Configuration/environment paths
- Generated/low-review-value files
- Changed tests/docs
- Repository evidence (package manager, test script, typecheck script, CI workflow)

Risk categories are counted once per category. Scores are capped at 100: low is `0–19`, medium is `20–49`, and high is `50–100`. Tests affect evidence and focus guidance, not the score.

## Privacy Guarantees

PR Nutrition v0.1 is local-first and built for trust:

- **No patch contents read**
- **No `.env` values read**
- **No source file contents read for analysis**
- **No network calls**
- **Deterministic local analysis**
- **No LLM support included in v0.1**

## v0.1 Non-goals

PR Nutrition does not judge correctness, detect bugs, suggest code changes, add inline comments, call GitHub APIs, or execute repository scripts. Configuration files, a GitHub Action, AST analysis, LLM wording polish, and split hints remain future work.

## Resources

- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Architecture Notes](docs/architecture.md)
- [Privacy Model](docs/privacy.md)

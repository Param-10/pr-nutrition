# PR Nutrition

PR Nutrition generates a deterministic review-readiness label for pull requests.

Not an AI code reviewer. Not a PR summary bot. A deterministic label that tells reviewers what changed, what looks risky, and where to focus.

## Example Output

See [examples/demo-pr/pr-nutrition.md](examples/demo-pr/pr-nutrition.md) for a complete example of the generated Markdown label.

## Quick Start (Local Development)

```bash
pnpm install
pnpm build
pnpm --filter pr-nutrition start -- --base main --head HEAD
```

## CLI Usage

Run the built CLI against any local Git repository:

```bash
pr-nutrition --repo . --base main --head HEAD
pr-nutrition --format json
pr-nutrition --output pr-label.md
```

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

## Privacy Guarantees

PR Nutrition v0.1 is local-first and built for trust:

- **No patch contents read**
- **No `.env` values read**
- **No source file contents read for analysis**
- **No network calls**
- **Deterministic local analysis**
- **No LLM support included in v0.1**

## Resources

- [Roadmap](ROADMAP.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Architecture Notes](docs/architecture.md)
- [Privacy Model](docs/privacy.md)

# AGENTS.md

## Project overview

PR Nutrition is a deterministic-first CLI and GitHub Action that generates a review-readiness label for pull requests.

The tool should tell reviewers:

- what changed
- what looks risky
- what evidence exists
- which files are likely generated or low-review-value
- where reviewers should focus first

This is not an AI code reviewer. The core product should be explainable, local-first, and rule-based. Optional LLM support may be added later only for wording or polish, not for deciding risk.

## Current product direction

Build in this order:

1. Core diff analyzer
2. Path and risk classifier
3. Markdown renderer
4. CLI package
5. Test fixtures
6. GitHub Action wrapper
7. Config file support
8. Optional LLM polish
9. PR split hints

For v0.1, prefer the smallest correct implementation. Do not add a config parser, GitHub API client, LLM client, AST parser, database, web UI, inline review comments, or `packages/action`.

## Tech stack

- TypeScript
- Node.js 22.13 or newer, below Node 27
- pnpm 11.8.0
- Vitest for tests
- tsup for builds
- GitHub Actions for CI

Prefer small packages and minimal dependencies.

## Architecture rules

- `packages/core`: diff parsing, classification, risk scoring, and output model
- `packages/cli`: command-line interface
- `packages/action`: future GitHub Action wrapper
- `examples`: demo repositories and sample outputs
- `docs`: design notes and contributor documentation

The core package must not depend on GitHub APIs. GitHub-specific logic belongs in the future action package.

## Coding rules

- Keep functions small and testable.
- Prefer deterministic rules over LLM calls.
- Do not hardcode one framework unless necessary.
- Avoid broad refactors unless explicitly requested.
- Explain any new large dependency before adding it.
- Add or update tests for every detector or rule.
- Keep output stable with golden tests.

## Testing commands

Before finishing code changes, run:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Security and privacy rules

- Never send source code to an external API by default.
- Do not read `.env` files except to detect their presence by path.
- Do not print secrets, tokens, or private environment values.
- Treat PR diffs as sensitive user data.
- LLM features must be opt-in.
- Do not execute repository scripts while analyzing a pull request.
- Do not use Git commands that print patch contents.

## PR rules

Every PR should include:

- what changed
- why it changed
- how it was tested
- sample PR Nutrition output when relevant

Use Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, and `refactor:`.

## Product principle

The value of this project is trust. Prefer boring, explainable, useful output over flashy AI behavior.

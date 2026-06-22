# Contributing to PR Nutrition

Thank you for contributing! We value deterministic rules and reliable local execution.

## Installation and Setup

1. Make sure you are using Node 22.13 or newer, and pnpm 11.8.0.
2. Install dependencies and build:

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Development Commands

Before opening or updating a PR, you must verify your changes locally:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke
```

## Running the CLI Locally

To run the local CLI against your current workspace:

```bash
pnpm build
pnpm --filter pr-nutrition start -- --base main --head HEAD
```

## Branch Naming and Pull Requests

- Use normal, descriptive branch names. Do NOT use the names of AI agents.
- No direct pushes to `main`.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`).

Every PR should explain:
- what changed
- why it changed
- how it was tested
- sample output if user-facing output changed

## Adding Analyzer Rules

When adding a new path matcher or risk classification to `packages/core`:
1. Update the smallest relevant module in `packages/core/src`.
2. Add a test case demonstrating the rule.
3. Update `AGENTS.md` rules if necessary.

## Modifying Renderer Output

When changing Markdown or JSON output in `packages/core`:
1. Update `packages/core/src/render.ts`.
2. Run `pnpm test` and update any affected golden test fixtures.
3. Run `node scripts/generate-examples.mjs` to regenerate output files in `examples/`.

## Updating Examples

If you change how the CLI processes rules, you must update the `examples/` directory by running the script (if your changes affect the core model or output):

```bash
node scripts/generate-examples.mjs
```

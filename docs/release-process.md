# Release Process

## Semantic Versioning
This project will follow SemVer. During pre-1.0 (`v0.x`), minor versions may contain breaking changes to the core engine, risk models, or CLI interfaces.

## Pre-Release Checks
Before triggering a release, maintainers must verify:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke
```

## Smoke Test Local Packages
Run the automated pack/install/execute check without publishing:

```bash
pnpm smoke
```

*Note: Automated npm publishing will be added in a future PR. Do not publish to npm directly.*

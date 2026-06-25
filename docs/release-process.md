# Release Process

## Semantic Versioning

This project follows SemVer. During pre-1.0 (`v0.x`), minor versions may contain breaking changes to the core engine, risk models, CLI interfaces, or Action interfaces.

## Pre-Release Checks

Before tagging a release, maintainers must verify the full local gate:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm action:bundle-check
pnpm build
pnpm smoke
pnpm release:check
```

`pnpm action:bundle-check` verifies that the committed GitHub Action bundle matches the current Action source. `pnpm smoke` verifies both the packed CLI and the committed Action bundle.

## Staged npm Publishing

Releases are staged through the GitHub Actions release workflow:

1. Update the CLI package version in `packages/cli/package.json`.
2. Merge the release-preparation PR.
3. Sync local `main` to `origin/main`.
4. Create and push an annotated SemVer tag that exactly matches the CLI package version, such as `v0.2.0`.
5. The `Release` workflow runs on numeric `vX.Y.Z` tags with `contents: read` and `id-token: write`.
6. The workflow installs pinned tooling, runs its release checks, verifies the tag matches the CLI package version, and runs `npm stage publish --access public` from `packages/cli`.
7. A maintainer reviews the staged package in npm and completes the separate human 2FA approval step.

The workflow uses OIDC for npm provenance and does not require a long-lived npm publish token in repository secrets.

## Local Smoke Test

Run the automated pack/install/execute check without publishing:

```bash
pnpm smoke
```

## Historical v0.1.0 Bootstrap

`v0.1.0` was published manually because npm staged publishing requires an existing package.

The bootstrap process required:

1. npm maintainer login with 2FA enabled.
2. A clean verified release commit.
3. `npm publish --access public` from `packages/cli`.
4. Verification with `npm view pr-nutrition@0.1.0`.
5. A fresh install and execution check in a temporary project.
6. The `v0.1.0` tag and GitHub release on the exact published commit.

This manual path is historical only. Future releases should use the staged OIDC workflow above.

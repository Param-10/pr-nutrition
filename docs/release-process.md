# Release Process

## Semantic Versioning

This project follows SemVer. During pre-1.0 (`v0.x`), minor versions may contain breaking changes to the core engine, risk models, CLI interfaces, or Action interfaces.

## Pre-Release Checks

Before tagging a release, maintainers must verify the full local gate:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm eval
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm action:bundle-check
corepack pnpm build
corepack pnpm smoke
corepack pnpm release:check
```

`pnpm eval` checks deterministic false-positive and rule-regression cases. `pnpm action:bundle-check` verifies that the committed GitHub Action bundle matches the current Action source. `pnpm smoke` verifies both the packed CLI and the committed Action bundle.

## Staged npm Publishing

`v0.2.0` and later releases are staged through the GitHub Actions release workflow:

1. Merge the release-readiness PR.
2. Sync local `main` to `origin/main`.
3. Verify the full gate on the exact merge commit.
4. Create an annotated SemVer tag that exactly matches the CLI package version, such as `v0.2.1`.
5. Push the tag.
6. The `Release` workflow runs on numeric `vX.Y.Z` tags with `contents: read` and `id-token: write`, then stages npm via OIDC with `npm stage publish --access public` from `packages/cli`.
7. A maintainer inspects the staged package in npm.
8. A maintainer approves publication with npm 2FA.
9. Verify npm provenance and fresh install behavior for the published package.
10. Create the GitHub release for the tag, such as `v0.2.1`.
11. Publish or update the Marketplace release only after npm and GitHub release verification, if that has been intentionally decided and scoped.
12. Do not create a floating `v0` tag yet.

The workflow uses OIDC for npm provenance and does not require a long-lived npm publish token in repository secrets.

## Local Smoke Test

Run the automated pack/install/execute check without publishing:

```bash
corepack pnpm smoke
```

## Historical v0.1.0 Bootstrap

`v0.1.0` was published manually because npm staged publishing requires an existing package. That first manual publish is complete.

The bootstrap process required:

1. npm maintainer login with 2FA enabled.
2. A clean verified release commit.
3. `npm publish --access public` from `packages/cli`.
4. Verification with `npm view pr-nutrition@0.1.0`.
5. A fresh install and execution check in a temporary project.
6. The `v0.1.0` tag and GitHub release on the exact published commit.

This manual path is historical only. Future releases should use the staged OIDC workflow above.

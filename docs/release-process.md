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
pnpm release:check
```

## Smoke Test Local Packages
Run the automated pack/install/execute check without publishing:

```bash
pnpm smoke
```

## One-Time v0.1.0 npm Bootstrap

The first publication must be completed manually because npm staged publishing requires an existing package.

Before publishing:

1. Create or log into the npm maintainer account.
2. Enable two-factor authentication on the account.
3. Merge the v0.1 release-readiness PR and sync local `main` to `origin/main`.
4. Confirm the working tree is clean and run every pre-release check above.
5. Confirm `pr-nutrition` is still available on npm.

Publish from the exact verified commit:

```bash
npm login --auth-type=web
cd packages/cli
npm publish --access public
```

Complete the interactive 2FA prompt. Do not place an npm token or one-time password in a file, command argument, repository secret, or shell history.

After publication:

1. Verify `npm view pr-nutrition@0.1.0`.
2. Install and execute `pr-nutrition@0.1.0` in a new temporary project.
3. Create annotated tag `v0.1.0` on the exact published commit and push it.
4. Publish the GitHub `v0.1.0` release with generated notes and the tarball checksum printed by `pnpm release:check`.
5. Require 2FA and disallow traditional publish tokens in the npm package settings.

The initial manual publication is the only exception. Staged OIDC publishing will be added in a separate PR after the package exists.

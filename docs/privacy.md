# Privacy

PR Nutrition guarantees a secure, local-first analysis model.

## Allowed (What it Inspects)
- Git file paths
- Git name/status metadata
- Git numstat metadata (additions/deletions)
- Git attributes (e.g. for `linguist-generated`)
- `package.json` scripts
- Approved manifest and lockfile presence
- Workflow filenames
- Pull-request base/head SHAs from the GitHub Actions event payload when running as an Action

## Allowed (What it Writes)
- Markdown reports
- JSON reports
- `$GITHUB_STEP_SUMMARY` Markdown when enabled
- GitHub Action outputs for score, level, changed-file count, and report paths

## Disallowed (What it Never Inspects)
- Patch contents
- Arbitrary source file contents
- `.env` contents
- Secrets
- Network calls
- LLM calls in v0.1
- GitHub API responses
- Pull request comments or review threads

Git is executed directly without a shell. The analyzer uses only merge-base, name/status, numstat, and generated-attribute metadata; it never requests patch bodies.

The GitHub Action does not fetch missing history automatically. Callers must use a full-history checkout so failures are explicit and reproducible.

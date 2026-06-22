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

## Disallowed (What it Never Inspects)
- Patch contents
- Arbitrary source file contents
- `.env` contents
- Secrets
- Network calls
- LLM calls in v0.1

Git is executed directly without a shell. The analyzer uses only merge-base, name/status, numstat, and generated-attribute metadata; it never requests patch bodies.

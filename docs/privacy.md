# Privacy

PR Nutrition guarantees a secure, local-first analysis model.

## Allowed (What it Inspects)
- Git file paths
- Git name/status metadata
- Git numstat metadata (additions/deletions)
- Git attributes (e.g. for `linguist-generated`)
- `package.json` scripts
- Lockfile presence
- Workflow filenames

## Disallowed (What it Never Inspects)
- Patch contents
- Arbitrary source file contents
- `.env` contents
- Secrets
- Network calls
- LLM calls in v0.1

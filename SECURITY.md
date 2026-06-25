# Security Policy

## Supported Versions
Only the `main` branch (pre-1.0) is currently supported for security updates.

## Privacy and Data Flow
PR Nutrition is local-first and does not make network calls during analysis.
It runs exclusively on your local machine or CI runner.

### Privacy-Sensitive Areas
The analyzer intentionally completely avoids reading or leaking:
- Patch contents (diff bodies)
- `.env` files and values
- Secrets and tokens
- Repository source code (source files are not read or uploaded)
- Workflow contents or CI secrets

Only file paths, counts, Git attributes, approved manifest presence, `package.json` script names, lockfile presence, and workflow filenames are used.

When running as a GitHub Action, PR Nutrition may also read pull-request base/head SHAs from the event payload, write Markdown and JSON report files, append Markdown to `$GITHUB_STEP_SUMMARY`, and set Action outputs. The Action does not call GitHub APIs, post comments, request write permissions, mutate pull requests, or fetch missing Git history automatically.

## Reporting a Vulnerability

If you discover a vulnerability, please report it privately.
Please use GitHub Security Advisories if enabled for this repository. If not, open a private contact route via the maintainers.

**Do not include secrets, tokens, or private code in public issues.**

# Security Policy

## Supported Versions
Only the `main` branch (pre-1.0) is currently supported for security updates.

## Privacy and Data Flow
PR Nutrition v0.1 is local-first and does not make network calls.
It runs exclusively on your local machine or CI runner.

### Privacy-Sensitive Areas
The analyzer intentionally completely avoids reading or leaking:
- Patch contents (diff bodies)
- `.env` files and values
- Secrets and tokens
- Repository source code (source files are not read or uploaded)
- Workflow contents or CI secrets

Only file paths, counts, Git attributes, approved manifest presence, `package.json` script names, lockfile presence, and workflow filenames are used.

## Reporting a Vulnerability

If you discover a vulnerability, please report it privately.
Please use GitHub Security Advisories if enabled for this repository. If not, open a private contact route via the maintainers.

**Do not include secrets, tokens, or private code in public issues.**

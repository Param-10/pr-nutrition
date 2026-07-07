# Roadmap

PR Nutrition's center of gravity is a local-first PR triage CLI. CI and GitHub Action support should surface the same report without creating reviewer noise, comments, write permissions, or GitHub API dependency.

## v0.1
- deterministic core analyzer
- markdown/json renderers
- CLI package
- docs and examples
- generated and low-review-value path heuristics

## v0.2 - release readiness
- [x] read-only GitHub Action
- [x] Markdown step summary, Markdown/JSON report files, and Action outputs
- [x] reproducible committed Node 24 Action bundle
- [x] PR-only real-runner Action dogfood
- [x] false-positive evaluation cases
- [x] package-manager script hardening
- [x] strict JSON config file support
- [x] CLI `--json` shortcut
- [x] deterministic `--explain` output
- [x] focused file review groups with `--focus-files`
- [x] local setup diagnostics with `doctor`

## v0.3
- local workflow support that prints or saves reports without blocking by default
- `--fail-on` for teams that explicitly opt into CI enforcement
- richer deterministic framework and infrastructure rules
- additional generated-file ecosystems
- false-positive benchmark and issue template

## Later
- optional LLM wording polish
- split suggestions
- optional PR body generation
- optional PR comments only after repeated user demand
- VS Code extension or web docs

*Note: LLM features are optional and not part of the trusted risk engine.*

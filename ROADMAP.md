# Roadmap

PR Nutrition's center of gravity is a local-first PR triage CLI. CI and GitHub Action support should surface the same report without creating reviewer noise, comments, write permissions, or GitHub API dependency.

## v0.1
- deterministic core analyzer
- markdown/json renderers
- CLI package
- docs and examples
- generated and low-review-value path heuristics

## v0.2 - in progress
- [x] read-only GitHub Action
- [x] Markdown step summary, Markdown/JSON report files, and Action outputs
- [x] reproducible committed Node 24 Action bundle
- [x] PR-only real-runner Action dogfood
- [ ] strict JSON config file support
- [ ] false-positive evaluation cases
- [ ] richer package/script detection
- [ ] more language/framework path rules

## v0.3
- CLI UX improvements such as `--explain`, `--focus-files`, and `doctor`
- local workflow support that prints or saves reports without blocking by default
- `--fail-on` for teams that explicitly opt into CI enforcement
- additional generated-file ecosystems
- false-positive benchmark and issue template

## Later
- optional LLM wording polish
- split suggestions
- optional PR body generation
- optional PR comments only after repeated user demand
- VS Code extension or web docs

*Note: LLM features are optional and not part of the trusted risk engine.*

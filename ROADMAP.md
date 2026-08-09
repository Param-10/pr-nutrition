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

## v0.2.1 - precision
- [x] scoped risk-area rules to path segments and known configuration, infrastructure, and contract paths
- [x] removed blanket `.json`/`.yml`/`.yaml` configuration matching
- [x] scaled CI, API, dependency, and configuration points with change magnitude
- [x] kept migrations and authentication presence-based
- [x] corrected an eval expectation that asserted the false positive it was meant to prevent

## v0.3
- [x] rank and cap the review-first / focus-file lists so the top of the report stays short
- [x] false-positive benchmark reporting a precision number
- [x] broader dependency ecosystem coverage and presence-based CI scoring
- [x] coverage section for what was checked and what was not
- [x] local `check` workflow that prints or saves reports without blocking by default
- [x] `--fail-on` for teams that explicitly opt into enforcement
- richer deterministic framework and infrastructure rules
- additional generated-file ecosystems
- issue template for reporting a misclassification

## Later
- optional LLM wording polish
- split suggestions
- optional PR body generation
- optional PR comments only after repeated user demand
- VS Code extension or web docs

*Note: LLM features are optional and not part of the trusted risk engine.*

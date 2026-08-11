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

## v0.2.1 - trust and accuracy
- [x] scoped risk-area rules to path segments and known configuration, infrastructure, and contract paths
- [x] removed blanket `.json`/`.yml`/`.yaml` configuration matching
- [x] scaled CI, API, dependency, and configuration points with change magnitude
- [x] kept migrations and authentication presence-based
- [x] corrected an eval expectation that asserted the false positive it was meant to prevent

## v0.3
- [x] rank and cap the review-first / focus-file lists so the top of the report stays short
- [x] false-positive and true-positive guard-case pass-rate reporting
- [x] broader dependency ecosystem coverage and presence-based CI scoring
- [x] coverage section for what was checked and what was not
- [x] local `check` workflow that prints or saves reports without blocking by default
- [x] `--fail-on` for teams that explicitly opt into enforcement
- [x] issue template for reporting a misclassification
- richer deterministic framework and infrastructure rules
- additional generated-file ecosystems

## v0.3.1 - trust pass
- [x] magnitude-aware focus ranking with a v0.2.1-to-v0.3.0 dogfood regression case
- [x] consistent Ruby, Java/Gradle, PHP, and Python repository evidence
- [x] dependency-manifest precedence over generic API directories
- [x] honest guard-case terminology instead of statistical precision claims
- [x] discoverable `check` and `doctor` CLI subcommands
- [x] supported local Node pin and enforced PR authoring policy

## Next
- build a locally labeled corpus from real PR path metadata using the [real-world benchmark guide](docs/real-world-benchmark.md) before claiming precision or recall
- add richer framework, infrastructure, and generated-file rules only with positive and near-miss cases

## Later
- optional LLM wording polish
- split suggestions
- optional PR body generation
- optional PR comments only after repeated user demand
- VS Code extension or web docs

*Note: LLM features are optional and not part of the trusted risk engine.*

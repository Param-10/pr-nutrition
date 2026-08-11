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

## v0.4.0 - benchmark-calibrated accuracy
- [x] label and analyze 33 real local PRs across six repositories without reading patch contents
- [x] separate production size risk from test and documentation volume
- [x] rank implementation ahead of larger tests and docs while preserving risk-area priority
- [x] recognize conventional Xcode test targets and COBOL production changes
- [x] add positive and near-miss guards for every new rule
- [x] document calibration-set results without claiming statistical precision or recall

## Immediate next five
1. Validate against a held-out set of 25–50 PRs from repositories not used for v0.4.0 calibration; publish the labeling and comparison method before using precision or recall terminology.
2. Add exact production file/line counts to the public result model and renderers so every size-risk point is directly explainable.
3. Make focus ordering honor configured custom test and documentation paths, not only built-in path heuristics.
4. Expand infrastructure and generated-file rules only for repeated held-out misses, always with a positive case and a near-miss case.
5. Run short reviewer usability sessions and capture false-positive reports through the existing issue template; prioritize changes that reduce review work without adding notifications or write permissions.

## Later
- optional LLM wording polish
- split suggestions
- optional PR body generation
- optional PR comments only after repeated user demand
- VS Code extension or web docs

*Note: LLM features are optional and not part of the trusted risk engine.*

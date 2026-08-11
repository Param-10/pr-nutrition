# v0.4.0 development benchmark

This benchmark calibrated PR Nutrition's deterministic rules against 33 merged pull requests from six repositories already available locally. It covered Swift/iOS, Python and TypeScript, and COBOL projects.

The cases were selected before viewing PR Nutrition output. Each case used the pull request's exact base and head commits. Labels for expected risk, risk areas, focus order, skim behavior, and missing-test guidance were written separately from generated reports.

PR Nutrition remained within its metadata-only boundary: the benchmark used repository-relative paths, change status, line counts, and safe repository evidence. It did not copy patch contents into the benchmark, read `.env` values, execute analyzed repository scripts, or upload reports. Raw reports and labels stayed outside this repository because they contain local repository paths.

## Results

| Check | v0.3.1 baseline | v0.4.0 rules |
|---|---:|---:|
| Exact risk band | 21/33 | 33/33 |
| Expected risk areas | 33/33 | 33/33 |
| Expected focus order | 27/33 | 33/33 |
| Expected skim behavior | 33/33 | 33/33 |
| Expected missing-test guidance | 25/33 | 33/33 |

The repeated baseline disagreements were:

- tests and documentation contributing to overall size risk
- large tests or docs outranking implementation files
- Xcode test-target folders not counting as tests
- COBOL source files not counting as test-relevant production changes

Each resulting rule has permanent positive and near-miss coverage in `eval/`.

## Limits

This is a development calibration set, not a held-out external corpus. Its pass rates are not estimates of statistical precision or recall. Generic paths can also hide semantic risk that a metadata-only analyzer cannot infer, such as authentication behavior inside a monolithic source file or the consequence of a dependency version jump.

The next measurement milestone is a separately labeled held-out set of 25–50 pull requests from repositories not used during v0.4.0 development.

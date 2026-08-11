# Real-world benchmark guide

Use this guide after a PR Nutrition release to evaluate the tool against pull requests from other repositories. The analysis stays local: PR Nutrition reads Git metadata, repository-relative paths, line counts, and selected safe repository evidence. It does not read patch contents, execute repository scripts, or upload source code.

## Where the pull requests come from

You can use any Git repository already available on your machine:

- active feature branches in your own projects
- historical pull requests from repositories you can access
- public repositories cloned locally to add ecosystems you do not use yourself

Aim for 25–50 pull requests across at least five repositories. Choose the cases before looking at PR Nutrition output so the sample is not biased toward known successes or failures. Include small and large changes, low- and high-risk changes, dependency-only changes, generated output, tests, docs, CI, authentication, migrations, and API contracts.

Keep private-project reports in a private directory outside the PR Nutrition repository. Reports contain file paths and repository evidence even though they do not contain source or patch contents.

## Analyze an active local branch

First check that the refs and repository evidence are available:

```bash
pr-nutrition doctor \
  --repo /absolute/path/to/project \
  --base origin/main \
  --head feature/my-change
```

Then save the deterministic JSON report:

```bash
pr-nutrition check \
  --repo /absolute/path/to/project \
  --base origin/main \
  --head feature/my-change \
  --json \
  --output /absolute/path/to/private-benchmark/reports/project-active-change.json
```

Replace `origin/main` when the repository uses another default branch. The base and head may be branch names, tags, or commit SHAs as long as both objects exist locally.

## Analyze a historical GitHub pull request

GitHub exposes the exact base and head commit identifiers through `gh`. This is useful after a branch was deleted or the default branch moved forward.

```bash
gh pr view 123 \
  --repo OWNER/REPOSITORY \
  --json baseRefOid,headRefOid
```

Copy the two SHAs from that output. Make sure the commits exist in the local clone:

```bash
git -C /absolute/path/to/project fetch origin BASE_SHA HEAD_SHA
```

If the head SHA is no longer directly fetchable, fetch GitHub's retained pull-request head ref:

```bash
git -C /absolute/path/to/project fetch \
  origin pull/123/head:refs/pr-nutrition/pr-123
```

Run PR Nutrition with the exact PR refs:

```bash
pr-nutrition check \
  --repo /absolute/path/to/project \
  --base BASE_SHA \
  --head HEAD_SHA \
  --json \
  --output /absolute/path/to/private-benchmark/reports/project-pr-123.json
```

Fetching refs is a separate preparation step performed by you. PR Nutrition itself does not fetch history or call GitHub APIs.

## Label each case manually

Read the pull request locally and write the expected result before comparing it with the generated report. A small JSON file beside each report is enough:

```json
{
  "caseId": "project-pr-123",
  "ecosystem": "node-typescript",
  "expectedRiskLevel": "medium",
  "expectedAreas": ["ci", "dependencies"],
  "expectedReviewFirst": [".github/workflows/ci.yml"],
  "expectedReviewNormally": ["package.json"],
  "expectedSkim": ["pnpm-lock.yaml"],
  "notes": "Small dependency update plus a workflow permission change."
}
```

The manual label is the benchmark ground truth. PR Nutrition output is the observed result. Keep those two files separate so the tool does not define its own expected answer.

## What to record

For every case, record:

- repository and PR identifier
- ecosystem
- expected and observed risk level
- expected and observed risk areas
- expected and observed review-first files
- false-positive files or areas
- missed files or areas
- whether the output was useful without adding reviewer work

Do not describe the result as statistical precision or recall until the sample is labeled independently and the calculation method is documented. The current built-in eval numbers remain regression guard-case pass rates.

## What happens after 25–50 cases

Group disagreements by rule instead of immediately adding detectors. Prioritize the two or three repeated failure patterns that caused the most reviewer confusion. Every resulting rule should include both a positive fixture and a near-miss fixture before it ships.

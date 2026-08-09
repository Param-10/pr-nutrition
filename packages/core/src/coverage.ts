import type { AnalysisCoverage } from "./types.js";

const ALWAYS_CHECKED = [
  "Path risk areas: migrations, authentication, CI, API contracts, dependencies, configuration",
  "Generated, low-review-value, test, and docs path heuristics",
  "Repository evidence: manifests, package manager, scripts, and CI workflow presence",
  "Git change metadata: paths, rename/copy status, and line counts (not patch contents)",
] as const;

const ALWAYS_NOT_CHECKED = [
  "Diff line contents and semantic correctness",
  "Vulnerability databases or dependency audit results",
  "Test execution or CI job outcomes",
  "LLM review or automated bug finding",
] as const;

export function buildCoverage(options: { focusFiles?: boolean } = {}): AnalysisCoverage {
  const checked: string[] = [...ALWAYS_CHECKED];
  if (options.focusFiles === true) {
    checked.push("Focus-file ranking into review-first, review-normally, and skim groups");
  }
  return {
    checked,
    notChecked: [...ALWAYS_NOT_CHECKED],
  };
}

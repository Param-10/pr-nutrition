import { resolve } from "node:path";
import { getRiskArea, isDocFile, isGeneratedFile, isLowValueFile, isTestFile, isTestRelevantFile, resolveRiskArea, RISK_AREAS } from "./classifier.js";
import { createConfigMatcher } from "./config.js";
import { collectRepositoryEvidence } from "./evidence.js";
import { buildExplanations } from "./explain.js";
import { buildFocusFileGroups } from "./focus.js";
import { getGitDiff } from "./git.js";
import { calculateRisk } from "./scorer.js";
import type { AnalysisResult, AnalyzeOptions, AreaClassification, ChangedFile, RiskAreaId } from "./types.js";

function buildAreas(areaFiles: Map<RiskAreaId, string[]>): AreaClassification[] {
  return RISK_AREAS.flatMap((definition) => {
    const files = areaFiles.get(definition.id);
    return files === undefined
      ? []
      : [{ id: definition.id, label: definition.label, files: [...files].sort() }];
  });
}

function buildReviewFocus(areas: AreaClassification[], hasUncoveredProductionChanges: boolean): string[] {
  const activeAreas = new Set(areas.map((area) => area.id));
  const focus = RISK_AREAS.filter((definition) => activeAreas.has(definition.id)).map(
    (definition) => definition.focus,
  );
  if (hasUncoveredProductionChanges) {
    focus.push("Production changes detected without changed tests; verify coverage.");
  }
  return focus.slice(0, 5);
}

export async function analyzePullRequest(options: AnalyzeOptions): Promise<AnalysisResult> {
  const resolvedRepoPath = resolve(options.repoPath);
  const gitDiff = getGitDiff(options.baseRef, options.headRef, resolvedRepoPath);
  const warnings = [...gitDiff.warnings];
  const evidence = collectRepositoryEvidence(resolvedRepoPath, warnings);
  const configMatcher = createConfigMatcher(options.config);
  const areaFiles = new Map<RiskAreaId, string[]>();
  const lowReviewValueFiles: ChangedFile[] = [];
  let additions = 0;
  let deletions = 0;
  let reviewableFiles = 0;
  let reviewableLines = 0;
  let hasTestRelevantChanges = false;

  const files = gitDiff.files.map((gitFile): ChangedFile => {
    const isGenerated =
      gitFile.isGenerated || isGeneratedFile(gitFile.path) || configMatcher.isGenerated(gitFile.path);
    const isLowValue =
      isGenerated ||
      gitFile.isBinary ||
      isLowValueFile(gitFile.path) ||
      configMatcher.isLowReviewValue(gitFile.path);
    const file = { ...gitFile, isGenerated, isLowValue };
    const classificationPaths = [file.path, ...(file.previousPath === undefined ? [] : [file.previousPath])];

    additions += file.additions;
    deletions += file.deletions;
    if (isLowValue) {
      lowReviewValueFiles.push(file);
    } else {
      reviewableFiles++;
      reviewableLines += file.additions + file.deletions;
    }

    evidence.hasChangedTests ||= classificationPaths.some(
      (path) => isTestFile(path) || configMatcher.isTest(path),
    );
    evidence.hasChangedDocs ||= classificationPaths.some(
      (path) => isDocFile(path) || configMatcher.isDoc(path),
    );
    hasTestRelevantChanges ||=
      !isLowValue &&
      classificationPaths.some(
        (path) => isTestRelevantFile(path) && !configMatcher.isTest(path) && !configMatcher.isDoc(path),
      );

    const riskArea = classificationPaths
      .map((path) => resolveRiskArea(getRiskArea(path), configMatcher.getRiskArea(path)))
      .find((area) => area !== undefined);
    if (riskArea !== undefined) {
      const paths = areaFiles.get(riskArea) ?? [];
      paths.push(file.path);
      areaFiles.set(riskArea, paths);
    }

    return file;
  });

  const areas = buildAreas(areaFiles);
  const risk = calculateRisk(reviewableFiles, reviewableLines, areas);
  const reviewFocus = buildReviewFocus(areas, hasTestRelevantChanges && !evidence.hasChangedTests);

  return {
    schemaVersion: 1,
    comparison: {
      repoPath: options.repoPath,
      baseRef: options.baseRef,
      headRef: options.headRef,
      mergeBase: gitDiff.mergeBase,
    },
    summary: {
      filesChanged: files.length,
      additions,
      deletions,
      reviewableFiles,
      reviewableLines,
    },
    files,
    areas,
    risk,
    evidence,
    lowReviewValueFiles,
    reviewFocus,
    ...(options.focusFiles === true ? { focusFiles: buildFocusFileGroups(files, areas) } : {}),
    warnings,
    ...(options.explain === true ? { explanations: buildExplanations(files, configMatcher) } : {}),
  };
}

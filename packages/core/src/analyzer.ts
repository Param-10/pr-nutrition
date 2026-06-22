import type { AnalysisResult, AnalyzeOptions, AreaClassification, RepositoryEvidence } from './types.js';
import { getGitDiff } from './git.js';
import { calculateRisk } from './scorer.js';
import {
  isTestFile,
  isDocFile,
  isLowValueFile,
  isMigration,
  isAuthentication,
  isCI,
  isApiContract,
  isDependencyManifest,
  isConfiguration,
} from './classifier.js';

export function analyzePullRequest(options: AnalyzeOptions): AnalysisResult {
  const { repoPath, baseRef, headRef } = options;
  const { files, mergeBase } = getGitDiff(baseRef, headRef, repoPath);

  const warnings: string[] = [];
  const reviewFocus: string[] = [];
  const lowReviewValueFiles: string[] = [];

  let filesChanged = 0;
  let additions = 0;
  let deletions = 0;
  let reviewableFiles = 0;
  let reviewableLines = 0;

  const areas: AreaClassification = {
    hasMigrations: false,
    hasAuthentication: false,
    hasCI: false,
    hasApiContracts: false,
    hasDependencies: false,
    hasConfiguration: false,
  };

  const evidence: RepositoryEvidence = {
    hasTests: false,
    hasDocs: false,
  };

  for (const file of files) {
    filesChanged++;
    additions += file.additions;
    deletions += file.deletions;

    file.isLowValue = file.isGenerated || isLowValueFile(file.path);

    if (file.isLowValue) {
      lowReviewValueFiles.push(file.path);
    } else {
      reviewableFiles++;
      reviewableLines += file.additions + file.deletions;
    }

    if (isTestFile(file.path)) evidence.hasTests = true;
    if (isDocFile(file.path)) evidence.hasDocs = true;

    if (isMigration(file.path)) areas.hasMigrations = true;
    if (isAuthentication(file.path)) areas.hasAuthentication = true;
    if (isCI(file.path)) areas.hasCI = true;
    if (isApiContract(file.path)) areas.hasApiContracts = true;
    if (isDependencyManifest(file.path)) areas.hasDependencies = true;
    if (isConfiguration(file.path)) areas.hasConfiguration = true;
  }

  const risk = calculateRisk(reviewableFiles, reviewableLines, areas);

  if (reviewableLines > 0 && !evidence.hasTests) {
    const msg = 'Production changes without tests';
    reviewFocus.push(msg);
    warnings.push(msg);
  }

  return {
    schemaVersion: 1,
    comparison: {
      repoPath,
      baseRef,
      headRef,
      mergeBase,
    },
    summary: {
      filesChanged,
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
    warnings,
  };
}

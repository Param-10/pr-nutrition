import type { AnalysisResult, AnalyzeOptions, RepositoryEvidence } from './types.js';
import { getGitDiff } from './git.js';
import { classifyFiles } from './classifier.js';
import { calculateRisk } from './scorer.js';

export function analyzePullRequest(options: AnalyzeOptions): AnalysisResult {
  const { repoPath, baseRef, headRef } = options;
  
  const { files, mergeBase } = getGitDiff(baseRef, headRef, repoPath);
  const warnings: string[] = [];

  let hasTests = false;
  let hasDocs = false;
  let hasConfigChanges = false;

  // Enrich files with classification
  classifyFiles(files);

  for (const file of files) {
    if (file.classification.isTest) {
      hasTests = true;
    }
    if (file.classification.isDoc) {
      hasDocs = true;
    }
    if (file.classification.isConfig) {
      hasConfigChanges = true;
    }
  }

  const evidence: RepositoryEvidence = {
    hasTests,
    hasDocs,
    hasConfigChanges,
  };

  const risk = calculateRisk(files, evidence);

  return {
    files,
    evidence,
    risk,
    warnings,
    comparison: {
      baseRef,
      headRef,
      mergeBase,
    },
  };
}

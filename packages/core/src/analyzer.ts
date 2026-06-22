import type { PRNutritionResult, AnalysisEvidence } from './types.js';
import { getGitDiff } from './git.js';
import { isTestFile, isDocFile, isConfigFile, isGeneratedFile, isLowValueFile } from './classifier.js';
import { calculateRisk } from './scorer.js';

export function analyzePR(base: string, head: string, cwd: string = process.cwd()): PRNutritionResult {
  const files = getGitDiff(base, head, cwd);
  const warnings: string[] = [];

  let hasTests = false;
  let hasDocs = false;
  let hasConfigChanges = false;

  // Enrich files with classification
  for (const file of files) {
    file.isGenerated = isGeneratedFile(file.path);
    file.isLowValue = isLowValueFile(file.path);

    if (isTestFile(file.path)) {
      hasTests = true;
    }
    if (isDocFile(file.path)) {
      hasDocs = true;
    }
    if (isConfigFile(file.path)) {
      hasConfigChanges = true;
    }
  }

  const evidence: AnalysisEvidence = {
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
  };
}

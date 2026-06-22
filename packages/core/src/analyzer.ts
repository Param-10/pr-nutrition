import { join } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import type { AnalysisResult, AnalyzeOptions, AreaClassification, RepositoryEvidence, ChangedFile } from './types.js';
import { getGitDiff } from './git.js';
import { calculateRisk } from './scorer.js';
import {
  isTestFile,
  isDocFile,
  isLowValueFile,
  getRiskArea
} from './classifier.js';

export function analyzePullRequest(options: AnalyzeOptions): AnalysisResult {
  const { repoPath, baseRef, headRef } = options;
  const { files, mergeBase } = getGitDiff(baseRef, headRef, repoPath);

  const warnings: string[] = [];
  const reviewFocus: string[] = [];
  const lowReviewValueFiles: ChangedFile[] = [];

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
    hasChangedTests: false,
    hasChangedDocs: false,
    hasPackageManifest: false,
    packageManager: 'unknown',
    hasTestScript: false,
    hasTypecheckScript: false,
    hasCiWorkflow: false,
  };

  // Evaluate Repository Evidence from Disk
  try {
    const pkgPath = join(repoPath, 'package.json');
    if (existsSync(pkgPath)) {
      evidence.hasPackageManifest = true;
      try {
        const pkgContent = readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgContent);
        if (pkg.scripts) {
          if (pkg.scripts.test) evidence.hasTestScript = true;
          if (pkg.scripts.typecheck) evidence.hasTypecheckScript = true;
        }
      } catch {
        warnings.push('package.json is malformed');
      }
    }
  } catch {
    // Ignore permissions/read errors
  }

  // Detect Package Manager from lockfiles
  if (existsSync(join(repoPath, 'pnpm-lock.yaml'))) {
    evidence.packageManager = 'pnpm';
  } else if (existsSync(join(repoPath, 'yarn.lock'))) {
    evidence.packageManager = 'yarn';
  } else if (existsSync(join(repoPath, 'package-lock.json'))) {
    evidence.packageManager = 'npm';
  }

  // Detect CI Workflows
  try {
    const workflowsPath = join(repoPath, '.github/workflows');
    if (existsSync(workflowsPath)) {
      const filesInWorkflows = readdirSync(workflowsPath);
      for (const file of filesInWorkflows) {
        if (file.endsWith('.yml') || file.endsWith('.yaml')) {
          evidence.hasCiWorkflow = true;
          break;
        }
      }
    }
  } catch {
    // Ignore permissions/read errors
  }

  // Evaluate PR-Specific Changes
  for (const file of files) {
    filesChanged++;
    additions += file.additions;
    deletions += file.deletions;

    file.isLowValue = file.isGenerated || isLowValueFile(file.path);

    if (file.isLowValue) {
      lowReviewValueFiles.push(file);
    } else {
      reviewableFiles++;
      reviewableLines += file.additions + file.deletions;
    }

    if (isTestFile(file.path)) evidence.hasChangedTests = true;
    if (isDocFile(file.path)) evidence.hasChangedDocs = true;

    // Apply strict priority classification
    const riskArea = getRiskArea(file.path);
    if (riskArea === 'migrations') areas.hasMigrations = true;
    else if (riskArea === 'authentication') areas.hasAuthentication = true;
    else if (riskArea === 'ci') areas.hasCI = true;
    else if (riskArea === 'api') areas.hasApiContracts = true;
    else if (riskArea === 'dependencies') areas.hasDependencies = true;
    else if (riskArea === 'configuration') areas.hasConfiguration = true;
  }

  const risk = calculateRisk(reviewableFiles, reviewableLines, areas);

  if (reviewableLines > 0 && !evidence.hasChangedTests) {
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

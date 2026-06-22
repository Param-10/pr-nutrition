import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { getRiskArea, isDocFile, isGeneratedFile, isLowValueFile, isTestFile, isTestRelevantFile, RISK_AREAS } from "./classifier.js";
import { getGitDiff } from "./git.js";
import { calculateRisk } from "./scorer.js";
import type { AnalysisResult, AnalyzeOptions, AreaClassification, ChangedFile, PackageManager, RepositoryEvidence, RiskAreaId } from "./types.js";

const MANIFESTS = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"] as const;
const MAX_PACKAGE_JSON_BYTES = 1024 * 1024;

function detectPackageManager(repoPath: string): PackageManager {
  const candidates: ReadonlyArray<[string, PackageManager]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
    ["uv.lock", "uv"],
    ["poetry.lock", "poetry"],
    ["Cargo.lock", "cargo"],
    ["go.mod", "go"],
  ];
  return candidates.find(([path]) => existsSync(join(repoPath, path)))?.[1] ?? "unknown";
}

function collectRepositoryEvidence(repoPath: string, warnings: string[]): RepositoryEvidence {
  const manifests = MANIFESTS.filter((manifest) => existsSync(join(repoPath, manifest)));
  const evidence: RepositoryEvidence = {
    hasChangedTests: false,
    hasChangedDocs: false,
    hasPackageManifest: manifests.length > 0,
    manifests: [...manifests],
    packageManager: detectPackageManager(repoPath),
    hasTestScript: false,
    hasTypecheckScript: false,
    hasCiWorkflow: false,
  };

  const packageJsonPath = join(repoPath, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const metadata = lstatSync(packageJsonPath);
      if (!metadata.isFile()) {
        warnings.push("package.json is not a regular file and was not inspected");
      } else if (metadata.size > MAX_PACKAGE_JSON_BYTES) {
        warnings.push("package.json exceeds the 1 MiB inspection limit");
      } else {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { scripts?: Record<string, unknown> };
        evidence.hasTestScript = typeof packageJson.scripts?.test === "string";
        evidence.hasTypecheckScript = typeof packageJson.scripts?.typecheck === "string";
      }
    } catch {
      warnings.push("package.json is malformed or unreadable");
    }
  }

  try {
    const workflowPath = join(repoPath, ".github", "workflows");
    evidence.hasCiWorkflow =
      existsSync(workflowPath) &&
      lstatSync(workflowPath).isDirectory() &&
      readdirSync(workflowPath).some((file) => /\.ya?ml$/i.test(file));
  } catch {
    warnings.push("Could not inspect GitHub workflow filenames");
  }

  return evidence;
}

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
  const areaFiles = new Map<RiskAreaId, string[]>();
  const lowReviewValueFiles: ChangedFile[] = [];
  let additions = 0;
  let deletions = 0;
  let reviewableFiles = 0;
  let reviewableLines = 0;
  let hasTestRelevantChanges = false;

  const files = gitDiff.files.map((gitFile): ChangedFile => {
    const isGenerated = gitFile.isGenerated || isGeneratedFile(gitFile.path);
    const isLowValue = isGenerated || gitFile.isBinary || isLowValueFile(gitFile.path);
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

    evidence.hasChangedTests ||= classificationPaths.some(isTestFile);
    evidence.hasChangedDocs ||= classificationPaths.some(isDocFile);
    hasTestRelevantChanges ||= !isLowValue && classificationPaths.some(isTestRelevantFile);

    const riskArea = classificationPaths.map(getRiskArea).find((area) => area !== undefined);
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
    warnings,
  };
}

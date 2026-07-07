import { riskAreaPriority } from "./classifier.js";
import type { AreaClassification, ChangedFile, FocusFile, FocusFileGroup, RiskAreaId } from "./types.js";

const FOCUS_GROUP_TITLES = ["review-first", "review-normally", "skim"] as const;

const AREA_REASONS: Record<RiskAreaId, string> = {
  migrations: "migration risk",
  authentication: "authentication risk",
  ci: "CI/workflow risk",
  api: "API contract risk",
  dependencies: "dependency risk",
  configuration: "configuration risk",
};

const LOCKFILE_NAMES = new Set([
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "uv.lock",
  "yarn.lock",
]);

const SKIM_REASON_ORDER = new Map([
  ["generated", 0],
  ["lockfile", 1],
  ["binary file", 2],
  ["vendored", 3],
  ["low-review-value", 4],
]);

function reviewableLineCount(file: ChangedFile): number {
  return file.isBinary ? 0 : file.additions + file.deletions;
}

function buildAreaByPath(areas: AreaClassification[]): Map<string, RiskAreaId> {
  const areaByPath = new Map<string, RiskAreaId>();
  for (const area of areas) {
    for (const path of area.files) {
      areaByPath.set(path, area.id);
    }
  }
  return areaByPath;
}

function skimReason(file: ChangedFile): string {
  const lowerPath = file.path.toLowerCase();
  const name = lowerPath.split("/").at(-1) ?? lowerPath;
  if (file.isGenerated) return "generated";
  if (LOCKFILE_NAMES.has(name) || /\.lock$/.test(name)) return "lockfile";
  if (file.isBinary) return "binary file";
  if (/(^|\/)(vendor|__snapshots__)(\/|$)/.test(lowerPath)) return "vendored";
  return "low-review-value";
}

function focusFile(
  file: ChangedFile,
  reason: string,
  area?: RiskAreaId,
): FocusFile {
  return {
    path: file.path,
    reason,
    ...(area === undefined ? {} : { area }),
    ...(file.isLowValue ? { lowReviewValue: true } : {}),
    ...(file.isGenerated ? { generated: true } : {}),
    ...(file.isBinary ? { binary: true } : {}),
    status: file.status,
  };
}

function emptyFocusGroups(): FocusFileGroup[] {
  return FOCUS_GROUP_TITLES.map((title) => ({ title, files: [] }));
}

export function buildFocusFileGroups(
  files: ChangedFile[],
  areas: AreaClassification[],
): FocusFileGroup[] {
  const areaByPath = buildAreaByPath(areas);
  const reviewFirst: FocusFile[] = [];
  const reviewNormally: FocusFile[] = [];
  const skim: FocusFile[] = [];

  for (const file of files) {
    if (file.isGenerated || file.isLowValue || file.isBinary) {
      skim.push(focusFile(file, skimReason(file)));
      continue;
    }

    const area = areaByPath.get(file.path);
    if (area !== undefined) {
      reviewFirst.push(focusFile(file, AREA_REASONS[area], area));
      continue;
    }

    reviewNormally.push(focusFile(file, "reviewable source change"));
  }

  const byReviewableLinesThenPath = (left: FocusFile, right: FocusFile): number => {
    const leftFile = files.find((file) => file.path === left.path);
    const rightFile = files.find((file) => file.path === right.path);
    const leftLines = leftFile === undefined ? 0 : reviewableLineCount(leftFile);
    const rightLines = rightFile === undefined ? 0 : reviewableLineCount(rightFile);
    if (leftLines !== rightLines) return rightLines - leftLines;
    return left.path.localeCompare(right.path);
  };

  reviewFirst.sort((left, right) => {
    const leftArea = left.area;
    const rightArea = right.area;
    if (leftArea !== undefined && rightArea !== undefined && leftArea !== rightArea) {
      return riskAreaPriority(leftArea) - riskAreaPriority(rightArea);
    }
    return byReviewableLinesThenPath(left, right);
  });

  reviewNormally.sort(byReviewableLinesThenPath);
  skim.sort((left, right) => {
    const leftOrder = SKIM_REASON_ORDER.get(left.reason) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = SKIM_REASON_ORDER.get(right.reason) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.path.localeCompare(right.path);
  });

  const groups = emptyFocusGroups();
  groups[0] = { title: "review-first", files: reviewFirst };
  groups[1] = { title: "review-normally", files: reviewNormally };
  groups[2] = { title: "skim", files: skim };
  return groups;
}

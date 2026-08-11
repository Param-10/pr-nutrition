import { RISK_AREAS, riskAreaPriority } from "./classifier.js";
import { LOW_VALUE_DEPENDENCY_FILE_NAMES } from "./dependency-files.js";
import { MODERATE_MAX_LINES, magnitudeBand } from "./scorer.js";
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

const SKIM_REASON_ORDER = new Map([
  ["generated", 0],
  ["lockfile", 1],
  ["binary file", 2],
  ["vendored", 3],
  ["low-review-value", 4],
]);

function reviewableLineCount(file: ChangedFile): number {
  return file.isLowValue ? 0 : file.additions + file.deletions;
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
  if (LOW_VALUE_DEPENDENCY_FILE_NAMES.has(name) || /\.lock$/.test(name)) return "lockfile";
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
  const filesByPath = new Map(files.map((file) => [file.path, file] as const));
  const reviewFirstAreas = new Set<RiskAreaId>();
  for (const area of areas) {
    const definition = RISK_AREAS.find((candidate) => candidate.id === area.id);
    if (definition?.magnitudePoints === undefined) {
      reviewFirstAreas.add(area.id);
      continue;
    }
    const lines = area.files.reduce((total, path) => {
      const file = filesByPath.get(path);
      return total + (file === undefined ? 0 : reviewableLineCount(file));
    }, 0);
    if (magnitudeBand({ files: area.files.length, lines }) !== "light") {
      reviewFirstAreas.add(area.id);
    }
  }
  const reviewFirst: FocusFile[] = [];
  const reviewNormally: FocusFile[] = [];
  const skim: FocusFile[] = [];

  for (const file of files) {
    if (file.isGenerated || file.isLowValue || file.isBinary) {
      skim.push(focusFile(file, skimReason(file)));
      continue;
    }

    const area = areaByPath.get(file.path);
    if (area !== undefined && reviewFirstAreas.has(area)) {
      reviewFirst.push(focusFile(file, AREA_REASONS[area], area));
      continue;
    }

    if (area === undefined && reviewableLineCount(file) > MODERATE_MAX_LINES) {
      reviewFirst.push(focusFile(file, "large reviewable change"));
      continue;
    }

    reviewNormally.push(
      area === undefined
        ? focusFile(file, "reviewable source change")
        : focusFile(file, AREA_REASONS[area], area),
    );
  }

  const reviewableLinesByPath = new Map(
    files.map((file) => [file.path, reviewableLineCount(file)] as const),
  );

  const byReviewableLinesThenPath = (left: FocusFile, right: FocusFile): number => {
    const leftLines = reviewableLinesByPath.get(left.path) ?? 0;
    const rightLines = reviewableLinesByPath.get(right.path) ?? 0;
    if (leftLines !== rightLines) return rightLines - leftLines;
    return left.path.localeCompare(right.path);
  };

  reviewFirst.sort((left, right) => {
    const leftArea = left.area;
    const rightArea = right.area;
    const leftPriority = leftArea === undefined ? Number.MAX_SAFE_INTEGER : riskAreaPriority(leftArea);
    const rightPriority = rightArea === undefined ? Number.MAX_SAFE_INTEGER : riskAreaPriority(rightArea);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
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

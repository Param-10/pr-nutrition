import { RISK_AREAS, type RiskAreaDefinition } from "./classifier.js";
import type { AreaClassification, RiskAreaId, RiskReason } from "./types.js";

const LIGHT_MAX_LINES = 10;
const MODERATE_MAX_FILES = 3;
const MODERATE_MAX_LINES = 60;

type MagnitudeBand = "light" | "moderate" | "full";

export interface AreaMagnitude {
  files: number;
  lines: number;
}

function magnitudeBand(magnitude: AreaMagnitude): MagnitudeBand {
  if (magnitude.files > MODERATE_MAX_FILES || magnitude.lines > MODERATE_MAX_LINES) return "full";
  if (magnitude.files > 1 || magnitude.lines > LIGHT_MAX_LINES) return "moderate";
  return "light";
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function areaPoints(definition: RiskAreaDefinition, band: MagnitudeBand): number {
  if (definition.magnitudePoints === undefined || band === "full") return definition.points;
  return definition.magnitudePoints[band];
}

function areaReason(
  definition: RiskAreaDefinition,
  magnitude: AreaMagnitude,
  points: number,
): RiskReason {
  const scope =
    definition.magnitudePoints === undefined
      ? ""
      : ` in ${countLabel(magnitude.files, "file")}, ${countLabel(magnitude.lines, "reviewable line")}`;
  return { description: `Touched ${definition.label.toLowerCase()}${scope}`, points };
}

export function calculateRisk(
  reviewableFiles: number,
  reviewableLines: number,
  areas: AreaClassification[],
  areaLines: ReadonlyMap<RiskAreaId, number> = new Map(),
): { score: number; level: "low" | "medium" | "high"; reasons: RiskReason[] } {
  let rawScore = 0;
  const reasons: RiskReason[] = [];
  const areaFileCounts = new Map(areas.map((area) => [area.id, area.files.length]));

  for (const definition of RISK_AREAS) {
    const files = areaFileCounts.get(definition.id);
    if (files === undefined) continue;
    const magnitude: AreaMagnitude = { files, lines: areaLines.get(definition.id) ?? 0 };
    const points = areaPoints(definition, magnitudeBand(magnitude));
    rawScore += points;
    reasons.push(areaReason(definition, magnitude, points));
  }

  if (reviewableFiles >= 30 || reviewableLines >= 800) {
    rawScore += 20;
    reasons.push({ description: "Size: at least 30 files or 800 lines", points: 20 });
  } else if (reviewableFiles >= 10 || reviewableLines >= 200) {
    rawScore += 10;
    reasons.push({ description: "Size: at least 10 files or 200 lines", points: 10 });
  }

  const score = Math.min(rawScore, 100);
  const level = score >= 50 ? "high" : score >= 20 ? "medium" : "low";

  return { score, level, reasons };
}

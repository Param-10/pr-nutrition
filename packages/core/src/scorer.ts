import { RISK_AREAS } from "./classifier.js";
import type { AreaClassification, RiskReason } from "./types.js";

export function calculateRisk(
  reviewableFiles: number,
  reviewableLines: number,
  areas: AreaClassification[],
): { score: number; level: "low" | "medium" | "high"; reasons: RiskReason[] } {
  let rawScore = 0;
  const reasons: RiskReason[] = [];
  const activeAreas = new Set(areas.map((area) => area.id));

  for (const definition of RISK_AREAS) {
    if (!activeAreas.has(definition.id)) continue;
    rawScore += definition.points;
    reasons.push({ description: `Touched ${definition.label.toLowerCase()}`, points: definition.points });
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

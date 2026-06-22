import type { AreaClassification, RiskReason } from './types.js';

export function calculateRisk(
  reviewableFiles: number,
  reviewableLines: number,
  areas: AreaClassification
): { score: number; level: 'low' | 'medium' | 'high'; reasons: RiskReason[] } {
  let score = 0;
  const reasons: RiskReason[] = [];

  // Size scoring (highest band only)
  if (reviewableFiles >= 30 || reviewableLines >= 800) {
    score += 20;
    reasons.push({ description: `Size: >= 30 files or 800 lines`, points: 20 });
  } else if (reviewableFiles >= 10 || reviewableLines >= 200) {
    score += 10;
    reasons.push({ description: `Size: >= 10 files or 200 lines`, points: 10 });
  }

  // Risk category weights
  if (areas.hasMigrations) {
    score += 30;
    reasons.push({ description: `Touched database migrations`, points: 30 });
  }
  if (areas.hasAuthentication) {
    score += 25;
    reasons.push({ description: `Touched authentication/security paths`, points: 25 });
  }
  if (areas.hasCI) {
    score += 20;
    reasons.push({ description: `Touched CI/workflows`, points: 20 });
  }
  if (areas.hasApiContracts) {
    score += 15;
    reasons.push({ description: `Touched API/public contracts`, points: 15 });
  }
  if (areas.hasDependencies) {
    score += 15;
    reasons.push({ description: `Touched dependency manifests/lockfiles`, points: 15 });
  }
  if (areas.hasConfiguration) {
    score += 15;
    reasons.push({ description: `Touched configuration/environment paths`, points: 15 });
  }

  let level: 'low' | 'medium' | 'high' = 'low';
  if (score >= 60) {
    level = 'high';
  } else if (score >= 30) {
    level = 'medium';
  }

  return {
    score,
    level,
    reasons,
  };
}

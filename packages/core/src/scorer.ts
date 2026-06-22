import type { ChangedFile, RepositoryEvidence, RiskReason } from './types.js';

export function calculateRisk(files: ChangedFile[], evidence: RepositoryEvidence): { score: number; level: 'low' | 'medium' | 'high'; reasons: RiskReason[] } {
  let score = 0;
  const reasons: RiskReason[] = [];

  let meaningfulFilesCount = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of files) {
    if (!file.classification.isGenerated && !file.classification.isLowValue) {
      meaningfulFilesCount++;
      totalAdditions += file.additions;
      totalDeletions += file.deletions;
    }
  }

  // Base risk from size of changes (highest band only)
  const linesChanged = totalAdditions + totalDeletions;
  if (linesChanged > 500) {
    score += 50;
    reasons.push({ description: `Large PR: ${linesChanged} lines changed in meaningful files`, points: 50 });
  } else if (linesChanged > 200) {
    score += 20;
    reasons.push({ description: `Medium-large PR: ${linesChanged} lines changed in meaningful files`, points: 20 });
  }

  if (meaningfulFilesCount > 20) {
    score += 30;
    reasons.push({ description: `Many files touched: ${meaningfulFilesCount} meaningful files`, points: 30 });
  }

  // Penalties
  if (!evidence.hasTests && meaningfulFilesCount > 0) {
    score += 30;
    reasons.push({ description: `No test files modified alongside meaningful changes`, points: 30 });
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

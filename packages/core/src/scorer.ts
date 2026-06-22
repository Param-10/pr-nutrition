import type { FileChange, AnalysisEvidence, RiskAnalysis, RiskLevel } from './types.js';

export function calculateRisk(files: FileChange[], evidence: AnalysisEvidence): RiskAnalysis {
  let score = 0;
  const reasons: string[] = [];

  let meaningfulFilesCount = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of files) {
    if (!file.isGenerated && !file.isLowValue) {
      meaningfulFilesCount++;
      totalAdditions += file.additions;
      totalDeletions += file.deletions;
    }
  }

  // Base risk from size of changes
  const linesChanged = totalAdditions + totalDeletions;
  if (linesChanged > 500) {
    score += 50;
    reasons.push(`Large PR: ${linesChanged} lines changed in meaningful files (+50 risk).`);
  } else if (linesChanged > 200) {
    score += 20;
    reasons.push(`Medium-large PR: ${linesChanged} lines changed in meaningful files (+20 risk).`);
  }

  if (meaningfulFilesCount > 20) {
    score += 30;
    reasons.push(`Many files touched: ${meaningfulFilesCount} meaningful files (+30 risk).`);
  }

  // Mitigations
  if (evidence.hasTests) {
    score -= 20;
    reasons.push(`Contains test changes (-20 risk).`);
  } else if (meaningfulFilesCount > 0) {
    score += 30;
    reasons.push(`No test files modified (+30 risk).`);
  }

  // Floor the score at 0
  score = Math.max(0, score);

  let level: RiskLevel = 'low';
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

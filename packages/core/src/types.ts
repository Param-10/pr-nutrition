export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';

export interface FileChange {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  isLowValue: boolean;
  isGenerated: boolean;
}

export interface AnalysisEvidence {
  hasTests: boolean;
  hasDocs: boolean;
  hasConfigChanges: boolean;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAnalysis {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

export interface PRNutritionResult {
  files: FileChange[];
  evidence: AnalysisEvidence;
  risk: RiskAnalysis;
  warnings: string[];
}

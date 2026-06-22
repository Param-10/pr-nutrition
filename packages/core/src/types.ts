export interface AreaClassification {
  isTest: boolean;
  isDoc: boolean;
  isConfig: boolean;
  isGenerated: boolean;
  isLowValue: boolean;
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown';

export interface ChangedFile {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  classification: AreaClassification;
}

export interface RepositoryEvidence {
  hasTests: boolean;
  hasDocs: boolean;
  hasConfigChanges: boolean;
}

export interface RiskReason {
  description: string;
  points: number;
}

export interface AnalysisResult {
  files: ChangedFile[];
  evidence: RepositoryEvidence;
  risk: {
    score: number;
    level: 'low' | 'medium' | 'high';
    reasons: RiskReason[];
  };
  warnings: string[];
  comparison: {
    baseRef: string;
    headRef: string;
    mergeBase: string;
  };
}

export interface AnalyzeOptions {
  repoPath: string;
  baseRef: string;
  headRef: string;
}


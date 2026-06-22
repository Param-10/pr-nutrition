export interface AreaClassification {
  hasMigrations: boolean;
  hasAuthentication: boolean;
  hasCI: boolean;
  hasApiContracts: boolean;
  hasDependencies: boolean;
  hasConfiguration: boolean;
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown';

export interface ChangedFile {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  isGenerated: boolean;
  isLowValue: boolean;
}

export interface RepositoryEvidence {
  hasTests: boolean;
  hasDocs: boolean;
}

export interface RiskReason {
  description: string;
  points: number;
}

export interface AnalysisResult {
  schemaVersion: 1;
  comparison: {
    repoPath: string;
    baseRef: string;
    headRef: string;
    mergeBase: string;
  };
  summary: {
    filesChanged: number;
    additions: number;
    deletions: number;
    reviewableFiles: number;
    reviewableLines: number;
  };
  files: ChangedFile[];
  areas: AreaClassification;
  risk: {
    score: number;
    level: 'low' | 'medium' | 'high';
    reasons: RiskReason[];
  };
  evidence: RepositoryEvidence;
  lowReviewValueFiles: string[];
  reviewFocus: string[];
  warnings: string[];
}

export interface AnalyzeOptions {
  repoPath: string;
  baseRef: string;
  headRef: string;
}


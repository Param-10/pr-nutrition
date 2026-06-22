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
  hasChangedTests: boolean;
  hasChangedDocs: boolean;
  hasPackageManifest: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  hasTestScript: boolean;
  hasTypecheckScript: boolean;
  hasCiWorkflow: boolean;
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
  lowReviewValueFiles: ChangedFile[];
  reviewFocus: string[];
  warnings: string[];
}

export interface AnalyzeOptions {
  repoPath: string;
  baseRef: string;
  headRef: string;
}


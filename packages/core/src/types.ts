export type RiskAreaId =
  | "migrations"
  | "authentication"
  | "ci"
  | "api"
  | "dependencies"
  | "configuration";

export interface AreaClassification {
  id: RiskAreaId;
  label: string;
  files: string[];
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown";

export interface ChangedFile {
  path: string;
  previousPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  isBinary: boolean;
  isGenerated: boolean;
  isLowValue: boolean;
}

export type PackageManager = "npm" | "yarn" | "pnpm" | "uv" | "poetry" | "cargo" | "go" | "unknown";

export interface RepositoryEvidence {
  hasChangedTests: boolean;
  hasChangedDocs: boolean;
  hasPackageManifest: boolean;
  manifests: string[];
  packageManager: PackageManager;
  hasTestScript: boolean;
  hasTypecheckScript: boolean;
  hasCiWorkflow: boolean;
}

export interface RiskReason {
  description: string;
  points: number;
}

export type ExplanationSource = "builtin" | "config" | "git";

export type ExplanationKind =
  | "risk-area"
  | "generated"
  | "low-review-value"
  | "test"
  | "docs"
  | "binary"
  | "rename"
  | "copy";

export interface AnalysisExplanation {
  path: string;
  kind: ExplanationKind;
  ruleId: string;
  source: ExplanationSource;
  reason: string;
  area?: RiskAreaId;
  pattern?: string;
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
  areas: AreaClassification[];
  risk: {
    score: number;
    level: "low" | "medium" | "high";
    reasons: RiskReason[];
  };
  evidence: RepositoryEvidence;
  lowReviewValueFiles: ChangedFile[];
  reviewFocus: string[];
  warnings: string[];
  explanations?: AnalysisExplanation[];
}

export interface AnalysisConfigPaths {
  generated?: string[];
  lowReviewValue?: string[];
  tests?: string[];
  docs?: string[];
  risk?: Partial<Record<RiskAreaId, string[]>>;
}

export interface AnalysisConfig {
  schemaVersion: 1;
  paths?: AnalysisConfigPaths;
}

export interface AnalyzeOptions {
  repoPath: string;
  baseRef: string;
  headRef: string;
  config?: AnalysisConfig;
  explain?: boolean;
}

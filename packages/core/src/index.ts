export { analyzePullRequest } from "./analyzer.js";
export {
  createConfigMatcher,
  DEFAULT_CONFIG_FILE_NAME,
  loadAnalysisConfig,
  validateAnalysisConfig,
} from "./config.js";
export type { ConfigMatcher, ConfigRiskMatch, LoadAnalysisConfigOptions } from "./config.js";
export { renderMarkdown, renderJson } from "./render.js";
export type { RenderOptions } from "./render.js";
export type {
  AnalysisConfig,
  AnalysisConfigPaths,
  AnalysisExplanation,
  AnalysisResult,
  AnalyzeOptions,
  ChangedFile,
  AreaClassification,
  ExplanationKind,
  ExplanationSource,
  FileStatus,
  PackageManager,
  RepositoryEvidence,
  RiskAreaId,
  RiskReason,
} from "./types.js";

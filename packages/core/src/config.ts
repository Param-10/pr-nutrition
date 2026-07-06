import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import picomatch from "picomatch";
import { RISK_AREAS } from "./classifier.js";
import type { AnalysisConfig, AnalysisConfigPaths, RiskAreaId } from "./types.js";

export const DEFAULT_CONFIG_FILE_NAME = ".pr-nutrition.json";
const MAX_CONFIG_BYTES = 64 * 1024;
const SUPPORTED_SCHEMA_VERSION = 1;
const TOP_LEVEL_KEYS = new Set(["schemaVersion", "paths"]);
const PATH_GROUP_KEYS = new Set(["generated", "lowReviewValue", "tests", "docs", "risk"]);
const RISK_AREA_IDS = new Set<string>(RISK_AREAS.map((area) => area.id));
const PICOMATCH_OPTIONS = { dot: true, strictBrackets: true, nonegate: true } as const;

export interface LoadAnalysisConfigOptions {
  repoPath: string;
  configFile?: string;
  useConfig?: boolean;
}

export interface ConfigMatcher {
  isGenerated: (path: string) => boolean;
  isLowReviewValue: (path: string) => boolean;
  isTest: (path: string) => boolean;
  isDoc: (path: string) => boolean;
  getRiskArea: (path: string) => RiskAreaId | undefined;
}

function configError(message: string): Error {
  return new Error(`Invalid PR Nutrition config: ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function validatePattern(pattern: unknown, group: string): string {
  if (typeof pattern !== "string") {
    throw configError(`'paths.${group}' entries must be strings`);
  }
  if (pattern.length === 0) {
    throw configError(`'paths.${group}' entries must not be empty`);
  }
  if (pattern.includes("\\")) {
    throw configError(`'paths.${group}' pattern must use POSIX forward slashes without backslashes`);
  }
  if (hasControlCharacter(pattern)) {
    throw configError(`'paths.${group}' pattern must not contain control characters`);
  }
  if (pattern.split("/").includes("..")) {
    throw configError(`'paths.${group}' pattern must not traverse parent directories`);
  }
  try {
    picomatch(pattern, PICOMATCH_OPTIONS);
  } catch {
    throw configError(`'paths.${group}' pattern is not a valid glob`);
  }
  return pattern;
}

function validatePatternGroup(value: unknown, group: string): string[] {
  if (!Array.isArray(value)) {
    throw configError(`'paths.${group}' must be an array of glob patterns`);
  }
  return value.map((pattern) => validatePattern(pattern, group));
}

function validateRiskPaths(value: unknown): Partial<Record<RiskAreaId, string[]>> {
  if (!isPlainObject(value)) {
    throw configError("'paths.risk' must be an object keyed by risk area");
  }
  const risk: Partial<Record<RiskAreaId, string[]>> = {};
  for (const [key, patterns] of Object.entries(value)) {
    if (!RISK_AREA_IDS.has(key)) {
      throw configError(`'paths.risk' has an unknown risk area '${key}'`);
    }
    risk[key as RiskAreaId] = validatePatternGroup(patterns, `risk.${key}`);
  }
  return risk;
}

export function validateAnalysisConfig(value: unknown): AnalysisConfig {
  if (!isPlainObject(value)) {
    throw configError("config must be a JSON object");
  }
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      throw configError(`unknown top-level key '${key}'`);
    }
  }
  if (!("schemaVersion" in value)) {
    throw configError("'schemaVersion' is required");
  }
  if (value.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw configError(`unsupported 'schemaVersion'; expected ${SUPPORTED_SCHEMA_VERSION}`);
  }

  const config: AnalysisConfig = { schemaVersion: 1 };
  if (!("paths" in value)) {
    return config;
  }
  if (!isPlainObject(value.paths)) {
    throw configError("'paths' must be an object");
  }

  const paths: AnalysisConfigPaths = {};
  for (const [key, group] of Object.entries(value.paths)) {
    if (!PATH_GROUP_KEYS.has(key)) {
      throw configError(`'paths' has an unknown key '${key}'`);
    }
    if (key === "risk") {
      paths.risk = validateRiskPaths(group);
    } else {
      paths[key as "generated" | "lowReviewValue" | "tests" | "docs"] = validatePatternGroup(group, key);
    }
  }
  config.paths = paths;
  return config;
}

function assertConfigPathInsideRepository(
  repoRoot: string,
  configPath: string,
  configFile: string,
): void {
  const relativePath = relative(repoRoot, configPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw configError(`config path must stay inside the repository (${configFile})`);
  }

  const segments = relativePath.split("/").filter((segment) => segment.length > 0);
  let current = repoRoot;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (segment === undefined) {
      continue;
    }
    current = resolve(current, segment);
    let metadata;
    try {
      metadata = lstatSync(current);
    } catch {
      if (index === segments.length - 1) {
        return;
      }
      throw configError(`config path is not reachable (${configFile})`);
    }
    if (metadata.isSymbolicLink()) {
      if (index === segments.length - 1) {
        throw configError(`config file must not be a symbolic link (${configFile})`);
      }
      throw configError(`config path must not cross a symbolic link directory (${configFile})`);
    }
  }
}

export function loadAnalysisConfig(options: LoadAnalysisConfigOptions): AnalysisConfig | undefined {
  if (options.useConfig === false) {
    return undefined;
  }

  const repoRoot = resolve(options.repoPath);
  const isExplicit = options.configFile !== undefined;
  const configFile = options.configFile ?? DEFAULT_CONFIG_FILE_NAME;
  const configPath = isAbsolute(configFile) ? configFile : resolve(repoRoot, configFile);
  assertConfigPathInsideRepository(repoRoot, configPath, configFile);

  let metadata;
  try {
    metadata = lstatSync(configPath);
  } catch {
    if (isExplicit) {
      throw configError(`config file not found (${configFile})`);
    }
    return undefined;
  }
  if (!metadata.isFile()) {
    throw configError(`config path is not a regular file (${configFile})`);
  }
  if (metadata.size > MAX_CONFIG_BYTES) {
    throw configError(`config file exceeds the 64 KiB limit (${configFile})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    throw configError(`config file is not valid JSON (${configFile})`);
  }

  return validateAnalysisConfig(parsed);
}

function compileGroup(patterns: string[] | undefined): (path: string) => boolean {
  if (patterns === undefined || patterns.length === 0) {
    return () => false;
  }
  const matchers = patterns.map((pattern) => picomatch(pattern, PICOMATCH_OPTIONS));
  return (path: string) => matchers.some((matches) => matches(path));
}

export function createConfigMatcher(config?: AnalysisConfig): ConfigMatcher {
  const paths = config?.paths;
  const isGenerated = compileGroup(paths?.generated);
  const isLowReviewValue = compileGroup(paths?.lowReviewValue);
  const isTest = compileGroup(paths?.tests);
  const isDoc = compileGroup(paths?.docs);
  const riskMatchers = RISK_AREAS.map((area) => ({
    id: area.id,
    matches: compileGroup(paths?.risk?.[area.id]),
  }));

  return {
    isGenerated,
    isLowReviewValue,
    isTest,
    isDoc,
    getRiskArea: (path: string) => riskMatchers.find((area) => area.matches(path))?.id,
  };
}

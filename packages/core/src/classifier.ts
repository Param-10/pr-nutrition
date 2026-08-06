import type { RiskAreaId } from "./types.js";

const DEPENDENCY_FILE_NAMES = new Set([
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "cargo.toml",
  "go.mod",
  "go.sum",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "pyproject.toml",
  "uv.lock",
  "yarn.lock",
]);

const LOW_VALUE_FILE_NAMES = new Set([
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "uv.lock",
  "yarn.lock",
]);

const AUTH_DIRECTORY_NAMES = new Set([
  "auth",
  "authentication",
  "authorization",
  "iam",
  "login",
  "permissions",
  "rbac",
  "security",
  "session",
  "sessions",
]);

// Matched against the whole filename stem, never a substring, so that
// LoginButton.tsx stays a component while login.ts stays auth logic.
const AUTH_FILE_STEMS = new Set([
  "auth",
  "authentication",
  "authorization",
  "jwt",
  "login",
  "logout",
  "mfa",
  "oauth",
  "password",
  "permission",
  "permissions",
  "role",
  "roles",
  "session",
  "sessions",
  "sso",
]);

const API_CONTRACT_DIRECTORY_NAMES = new Set(["api"]);

const CONFIGURATION_DIRECTORY_NAMES = new Set([
  ".config",
  "config",
  "deploy",
  "helm",
  "infra",
  "k8s",
  "kubernetes",
  "terraform",
]);

const CONFIGURATION_FILE_NAMES = new Set([
  ".node-version",
  ".npmrc",
  ".nvmrc",
  "compose.yaml",
  "compose.yml",
  "docker-compose.yaml",
  "docker-compose.yml",
  "dockerfile",
  "fly.toml",
  "jsconfig.json",
  "makefile",
  "netlify.toml",
  "nginx.conf",
  "procfile",
  "serverless.yaml",
  "serverless.yml",
  "vercel.json",
  "wrangler.toml",
]);

// Repository metadata that reviewers do not need triaged as production risk,
// even though the filenames look like configuration.
const NON_RISK_DIRECTORY_PREFIXES = [".github/issue_template/", ".github/pull_request_template/"];

export interface RiskAreaDefinition {
  id: RiskAreaId;
  label: string;
  points: number;
  /**
   * Reduced tiers for areas where the amount changed is a reasonable proxy for
   * review effort. Areas without tiers are scored on presence alone, because
   * there the existence of the change is the signal rather than its size: a
   * one-line migration can drop a table, and a two-line auth change can invert
   * a permission check.
   */
  magnitudePoints?: { light: number; moderate: number };
  focus: string;
}

export const RISK_AREAS: readonly RiskAreaDefinition[] = [
  {
    id: "migrations",
    label: "Database migrations",
    points: 30,
    focus: "Review migration safety, rollback behavior, and data compatibility.",
  },
  {
    id: "authentication",
    label: "Authentication and security",
    points: 25,
    focus: "Review authentication, authorization, and session edge cases.",
  },
  {
    id: "ci",
    label: "CI and workflows",
    points: 20,
    magnitudePoints: { light: 8, moderate: 14 },
    focus: "Review workflow permissions, triggers, and use of untrusted inputs.",
  },
  {
    id: "api",
    label: "API and public contracts",
    points: 15,
    magnitudePoints: { light: 5, moderate: 10 },
    focus: "Review backward compatibility of public API or contract changes.",
  },
  {
    id: "dependencies",
    label: "Dependencies",
    points: 15,
    magnitudePoints: { light: 5, moderate: 10 },
    focus: "Review dependency provenance, lockfile changes, and install scripts.",
  },
  {
    id: "configuration",
    label: "Configuration and environment",
    points: 15,
    magnitudePoints: { light: 5, moderate: 10 },
    focus: "Review configuration defaults and environment-specific behavior.",
  },
];

export function isTestFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  const name = lowerPath.split("/").at(-1) ?? lowerPath;
  return (
    /(^|\/)__tests__(\/|$)/.test(lowerPath) ||
    /(^|\/)tests?(\/|$)/.test(lowerPath) ||
    /\.(test|spec)\.[^/]+$/.test(lowerPath) ||
    /(^test_.*|.*_test)\.(py|go)$/.test(name)
  );
}

export function isDocFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    /(^|\/)docs?(\/|$)/.test(lowerPath) ||
    /(^|\/)(readme|changelog|contributing)(\.[^/]*)?$/.test(lowerPath) ||
    /\.(md|mdx|rst|txt)$/.test(lowerPath)
  );
}

export function isGeneratedFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    /(^|\/)(dist|build|coverage|generated)(\/|$)/.test(lowerPath) ||
    /\.generated\.[^/]+$/.test(lowerPath) ||
    /\.pb\.(go|js|ts)$/.test(lowerPath) ||
    /\.min\.(css|js)$/.test(lowerPath)
  );
}

export function isLowValueFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  const name = lowerPath.split("/").at(-1) ?? lowerPath;
  return (
    LOW_VALUE_FILE_NAMES.has(name) ||
    /(^|\/)(__snapshots__|vendor)(\/|$)/.test(lowerPath) ||
    /\.(gif|jpe?g|lock|map|png|snap|svg|webp)$/.test(lowerPath)
  );
}

export function isTestRelevantFile(path: string): boolean {
  if (isTestFile(path) || isDocFile(path)) return false;
  const lowerPath = path.toLowerCase();
  return (
    /(^|\/)(migrations|db\/migrate)(\/|$)/.test(lowerPath) ||
    /\.(c|cc|cpp|cs|go|java|js|jsx|php|py|rb|rs|sql|swift|ts|tsx)$/.test(lowerPath)
  );
}

const RISK_AREA_PRIORITY = new Map<RiskAreaId, number>(
  RISK_AREAS.map((definition, index) => [definition.id, index]),
);

export function riskAreaPriority(area: RiskAreaId): number {
  return RISK_AREA_PRIORITY.get(area) ?? Number.MAX_SAFE_INTEGER;
}

export function riskAreaLabel(area: RiskAreaId): string {
  return RISK_AREAS.find((definition) => definition.id === area)?.label ?? area;
}

export function resolveRiskArea(
  builtInArea: RiskAreaId | undefined,
  configArea: RiskAreaId | undefined,
): RiskAreaId | undefined {
  if (builtInArea === undefined) return configArea;
  if (configArea === undefined) return builtInArea;
  return riskAreaPriority(configArea) < riskAreaPriority(builtInArea) ? configArea : builtInArea;
}

function directoryNames(lowerPath: string): string[] {
  return lowerPath.split("/").slice(0, -1).filter((segment) => segment.length > 0);
}

function fileStem(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex <= 0 ? name : name.slice(0, dotIndex);
}

function hasDirectory(lowerPath: string, names: ReadonlySet<string>): boolean {
  return directoryNames(lowerPath).some((segment) => names.has(segment));
}

function isApiContractFile(name: string): boolean {
  return /^(openapi|asyncapi|swagger)([.-]|$)/.test(name) || /\.(proto|graphql|gql)$/.test(name);
}

function isConfigurationFile(lowerPath: string, name: string): boolean {
  return (
    /(^|\/)\.env(\.|$)/.test(lowerPath) ||
    name.endsWith(".env") ||
    CONFIGURATION_FILE_NAMES.has(name) ||
    /^dockerfile\./.test(name) ||
    /^tsconfig(\.|$)/.test(name) ||
    /\.config\./.test(name) ||
    /\.(tf|tfvars)$/.test(name)
  );
}

export function getRiskArea(path: string): RiskAreaId | undefined {
  if (isDocFile(path) || isTestFile(path)) return undefined;

  const lowerPath = path.toLowerCase();
  if (NON_RISK_DIRECTORY_PREFIXES.some((prefix) => lowerPath.startsWith(prefix))) return undefined;

  const name = lowerPath.split("/").at(-1) ?? lowerPath;
  const stem = fileStem(name);

  if (/(^|\/)(migrations|db\/migrate)(\/|$)/.test(lowerPath)) return "migrations";
  if (hasDirectory(lowerPath, AUTH_DIRECTORY_NAMES) || AUTH_FILE_STEMS.has(stem)) {
    return "authentication";
  }
  if (/(^|\/)(\.github\/workflows|\.circleci)(\/|$)/.test(lowerPath) || /(^|\/)\.gitlab-ci\.yml$/.test(lowerPath)) {
    return "ci";
  }
  if (hasDirectory(lowerPath, API_CONTRACT_DIRECTORY_NAMES) || isApiContractFile(name)) {
    return "api";
  }
  if (DEPENDENCY_FILE_NAMES.has(name)) {
    return "dependencies";
  }
  if (hasDirectory(lowerPath, CONFIGURATION_DIRECTORY_NAMES) || isConfigurationFile(lowerPath, name)) {
    return "configuration";
  }

  return undefined;
}

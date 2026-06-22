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

export interface RiskAreaDefinition {
  id: RiskAreaId;
  label: string;
  points: number;
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
    focus: "Review workflow permissions, triggers, and use of untrusted inputs.",
  },
  {
    id: "api",
    label: "API and public contracts",
    points: 15,
    focus: "Review backward compatibility of public API or contract changes.",
  },
  {
    id: "dependencies",
    label: "Dependencies",
    points: 15,
    focus: "Review dependency provenance, lockfile changes, and install scripts.",
  },
  {
    id: "configuration",
    label: "Configuration and environment",
    points: 15,
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

export function getRiskArea(path: string): RiskAreaId | undefined {
  const lowerPath = path.toLowerCase();
  const name = lowerPath.split("/").at(-1) ?? lowerPath;

  if (/(^|\/)(migrations|db\/migrate)(\/|$)/.test(lowerPath)) return "migrations";
  if (/(^|\/)(auth|security)(\/|$)/.test(lowerPath) || /(login|permissions|roles)/.test(lowerPath)) {
    return "authentication";
  }
  if (/(^|\/)(\.github\/workflows|\.circleci)(\/|$)/.test(lowerPath) || /(^|\/)\.gitlab-ci\.yml$/.test(lowerPath)) {
    return "ci";
  }
  if (/(^|\/)(api|types|interfaces)(\/|$)/.test(lowerPath) || /(openapi\.ya?ml|swagger)/.test(lowerPath)) {
    return "api";
  }
  if (DEPENDENCY_FILE_NAMES.has(name)) {
    return "dependencies";
  }
  if (/\.env(\.|$)/.test(lowerPath) || /(^|\/)config(\/|$)/.test(lowerPath) || /\.config\./.test(lowerPath) || /\.(json|ya?ml)$/.test(lowerPath)) {
    return "configuration";
  }

  return undefined;
}

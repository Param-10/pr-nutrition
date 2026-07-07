import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PackageManager, RepositoryEvidence } from "./types.js";

const MANIFESTS = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"] as const;
const MAX_PACKAGE_JSON_BYTES = 1024 * 1024;

export function detectPackageManager(repoPath: string): PackageManager {
  const candidates: ReadonlyArray<[string, PackageManager]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
    ["uv.lock", "uv"],
    ["poetry.lock", "poetry"],
    ["Cargo.lock", "cargo"],
    ["go.mod", "go"],
  ];
  return candidates.find(([path]) => existsSync(join(repoPath, path)))?.[1] ?? "unknown";
}

export function collectRepositoryEvidence(repoPath: string, warnings: string[]): RepositoryEvidence {
  const manifests = MANIFESTS.filter((manifest) => existsSync(join(repoPath, manifest)));
  const evidence: RepositoryEvidence = {
    hasChangedTests: false,
    hasChangedDocs: false,
    hasPackageManifest: manifests.length > 0,
    manifests: [...manifests],
    packageManager: detectPackageManager(repoPath),
    hasTestScript: false,
    hasTypecheckScript: false,
    hasCiWorkflow: false,
  };

  const packageJsonPath = join(repoPath, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const metadata = lstatSync(packageJsonPath);
      if (!metadata.isFile()) {
        warnings.push("package.json is not a regular file and was not inspected");
      } else if (metadata.size > MAX_PACKAGE_JSON_BYTES) {
        warnings.push("package.json exceeds the 1 MiB inspection limit");
      } else {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { scripts?: Record<string, unknown> };
        evidence.hasTestScript = typeof packageJson.scripts?.test === "string";
        evidence.hasTypecheckScript = typeof packageJson.scripts?.typecheck === "string";
      }
    } catch {
      warnings.push("package.json is malformed or unreadable");
    }
  }

  try {
    const workflowPath = join(repoPath, ".github", "workflows");
    evidence.hasCiWorkflow =
      existsSync(workflowPath) &&
      lstatSync(workflowPath).isDirectory() &&
      readdirSync(workflowPath).some((file) => /\.ya?ml$/i.test(file));
  } catch {
    warnings.push("Could not inspect GitHub workflow filenames");
  }

  return evidence;
}

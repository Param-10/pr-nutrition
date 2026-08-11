import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEPENDENCY_MANIFEST_FILE_NAMES,
  PACKAGE_MANAGER_FILE_CANDIDATES,
} from "./dependency-files.js";
import type { PackageManager, RepositoryEvidence } from "./types.js";

const WORKSPACE_ROOTS = ["packages", "apps", "libs", "services"] as const;
const MAX_PACKAGE_JSON_BYTES = 1024 * 1024;

function listWorkspacePackageDirs(repoPath: string): string[] {
  const packageDirs: string[] = [];
  for (const root of WORKSPACE_ROOTS) {
    const rootPath = join(repoPath, root);
    if (!existsSync(rootPath)) continue;
    try {
      if (!lstatSync(rootPath).isDirectory()) continue;
      for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          packageDirs.push(join(root, entry.name));
        }
      }
    } catch {
      // Ignore unreadable workspace roots; callers may add a warning later.
    }
  }
  return packageDirs.sort();
}

function collectManifestPaths(repoPath: string): string[] {
  const manifests: string[] = [];
  for (const manifest of DEPENDENCY_MANIFEST_FILE_NAMES) {
    if (existsSync(join(repoPath, manifest))) {
      manifests.push(manifest);
    }
  }
  for (const packageDir of listWorkspacePackageDirs(repoPath)) {
    for (const manifest of DEPENDENCY_MANIFEST_FILE_NAMES) {
      const relativePath = `${packageDir}/${manifest}`;
      if (existsSync(join(repoPath, relativePath))) {
        manifests.push(relativePath);
      }
    }
  }
  return manifests;
}

function detectPackageManagerAt(repoPath: string, relativeDir = ""): PackageManager | undefined {
  const base = relativeDir.length === 0 ? repoPath : join(repoPath, relativeDir);
  return PACKAGE_MANAGER_FILE_CANDIDATES.find(([path]) => existsSync(join(base, path)))?.[1];
}

export function detectPackageManager(repoPath: string): PackageManager {
  const rootManager = detectPackageManagerAt(repoPath);
  if (rootManager !== undefined) return rootManager;

  for (const packageDir of listWorkspacePackageDirs(repoPath)) {
    const nestedManager = detectPackageManagerAt(repoPath, packageDir);
    if (nestedManager !== undefined) return nestedManager;
  }

  return "unknown";
}

export function collectRepositoryEvidence(repoPath: string, warnings: string[]): RepositoryEvidence {
  const manifests = collectManifestPaths(repoPath);
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

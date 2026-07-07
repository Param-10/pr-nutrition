import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { DEFAULT_CONFIG_FILE_NAME, loadAnalysisConfig } from "./config.js";
import { collectRepositoryEvidence } from "./evidence.js";
import { runGit, validateRevision } from "./git.js";
import type { DoctorCheck, DoctorOptions, DoctorResult, DoctorStatus } from "./types.js";

interface DoctorState {
  checks: DoctorCheck[];
}

function addCheck(
  state: DoctorState,
  id: string,
  status: DoctorStatus,
  message: string,
  details?: DoctorCheck["details"],
): void {
  state.checks.push({
    id,
    status,
    message,
    ...(details === undefined ? {} : { details }),
  });
}

function buildResult(checks: DoctorCheck[]): DoctorResult {
  const warnings = checks.filter((entry) => entry.status === "warn").map((entry) => entry.message);
  const errors = checks.filter((entry) => entry.status === "fail").map((entry) => entry.message);
  return {
    schemaVersion: 1,
    command: "doctor",
    status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok",
    checks,
    warnings,
    errors,
  };
}

function isGitAvailable(): boolean {
  try {
    execFileSync("git", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function displayRelativePath(fromPath: string, targetPath: string): string {
  let relativePath: string;
  try {
    relativePath = relative(realpathSync(fromPath), realpathSync(targetPath));
  } catch {
    relativePath = relative(fromPath, targetPath);
  }
  return relativePath.length === 0 ? "." : relativePath;
}

function sanitizeConfigError(message: string, repoPath: string, configFile: string | undefined): string {
  let sanitized = message.replaceAll(repoPath, "<repo>");
  if (configFile !== undefined && isAbsolute(configFile)) {
    sanitized = sanitized.replaceAll(configFile, "<config>");
  }
  return sanitized.replace(/\s+\(<[^)]*>\)/g, "");
}

function refExists(repoPath: string, ref: string): boolean {
  try {
    runGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], repoPath);
    return true;
  } catch {
    return false;
  }
}

function findMergeBase(repoPath: string, baseRef: string, headRef: string): string | undefined {
  try {
    const value = runGit(["merge-base", baseRef, headRef], repoPath).trim();
    return value.length === 0 ? undefined : value;
  } catch {
    return undefined;
  }
}

function detectShallowRepository(repoPath: string): boolean | undefined {
  try {
    const value = runGit(["rev-parse", "--is-shallow-repository"], repoPath).trim();
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
  } catch {
    return undefined;
  }
}

function addConfigChecks(state: DoctorState, options: DoctorOptions, resolvedRepoPath: string): void {
  if (options.useConfig === false) {
    addCheck(state, "config.discovery", "pass", "Config loading disabled by --no-config.");
    addCheck(state, "config.validation", "pass", "Config validation skipped.");
    return;
  }

  const explicitConfig = options.configFile !== undefined;
  const configFile = options.configFile ?? DEFAULT_CONFIG_FILE_NAME;
  const displayPath = isAbsolute(configFile) ? displayRelativePath(resolvedRepoPath, configFile) : configFile;
  const discoveredPath = resolve(resolvedRepoPath, DEFAULT_CONFIG_FILE_NAME);

  if (!explicitConfig && !existsSync(discoveredPath)) {
    addCheck(state, "config.discovery", "pass", `No ${DEFAULT_CONFIG_FILE_NAME} discovered.`);
    addCheck(state, "config.validation", "pass", "Config validation skipped.");
    return;
  }

  addCheck(state, "config.discovery", "pass", `Config selected: ${displayPath}.`, { path: displayPath });

  try {
    loadAnalysisConfig({
      repoPath: resolvedRepoPath,
      ...(explicitConfig ? { configFile } : {}),
    });
    addCheck(state, "config.validation", "pass", `Config valid: ${displayPath}.`, { path: displayPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addCheck(
      state,
      "config.validation",
      "fail",
      `Config invalid: ${sanitizeConfigError(message, resolvedRepoPath, options.configFile)}.`,
      { path: displayPath },
    );
  }
}

function firstWarning(warnings: string[], pattern: RegExp): string | undefined {
  return warnings.find((warning) => pattern.test(warning));
}

function addEvidenceChecks(state: DoctorState, repoPath: string): void {
  const warnings: string[] = [];
  const evidence = collectRepositoryEvidence(repoPath, warnings);
  const packageWarning = firstWarning(warnings, /^package\.json/);
  const workflowWarning = firstWarning(warnings, /workflow/i);

  addCheck(
    state,
    "evidence.package-manifest",
    packageWarning === undefined ? "pass" : "warn",
    packageWarning ??
      (evidence.hasPackageManifest
        ? `Package manifest present: ${evidence.manifests.join(", ")}.`
        : "No package manifest detected."),
  );
  addCheck(
    state,
    "evidence.package-manager",
    "pass",
    evidence.packageManager === "unknown"
      ? "Package manager not detected."
      : `Package manager detected: ${evidence.packageManager}.`,
    { packageManager: evidence.packageManager },
  );
  addCheck(
    state,
    "evidence.test-script",
    "pass",
    evidence.hasTestScript ? "Test script detected." : "No test script detected.",
  );
  addCheck(
    state,
    "evidence.typecheck-script",
    "pass",
    evidence.hasTypecheckScript ? "Typecheck script detected." : "No typecheck script detected.",
  );
  addCheck(
    state,
    "evidence.ci-workflow",
    workflowWarning === undefined ? "pass" : "warn",
    workflowWarning ?? (evidence.hasCiWorkflow ? "CI workflow detected." : "No CI workflow detected."),
  );
}

export function runDoctor(options: DoctorOptions): DoctorResult {
  const state: DoctorState = { checks: [] };
  const resolvedRepoPath = resolve(options.repoPath);

  if (isGitAvailable()) {
    addCheck(state, "git.available", "pass", "Git command available.");
  } else {
    addCheck(state, "git.available", "fail", "Git command not available.");
    return buildResult(state.checks);
  }

  if (!existsSync(resolvedRepoPath)) {
    addCheck(state, "repo.path", "fail", "Repository path does not exist.");
    return buildResult(state.checks);
  }

  let repoMetadata;
  try {
    repoMetadata = lstatSync(resolvedRepoPath);
  } catch {
    addCheck(state, "repo.path", "fail", "Repository path is not readable.");
    return buildResult(state.checks);
  }

  if (!repoMetadata.isDirectory()) {
    addCheck(state, "repo.path", "fail", "Repository path is not a directory.");
    return buildResult(state.checks);
  }
  addCheck(state, "repo.path", "pass", "Repository path exists and is a directory.");

  const insideWorktree = (() => {
    try {
      return runGit(["rev-parse", "--is-inside-work-tree"], resolvedRepoPath).trim() === "true";
    } catch {
      return false;
    }
  })();
  if (!insideWorktree) {
    addCheck(state, "git.repository", "fail", "Git repository not found.");
    return buildResult(state.checks);
  }
  addCheck(state, "git.repository", "pass", "Git repository found.");

  let gitRoot: string;
  try {
    gitRoot = runGit(["rev-parse", "--show-toplevel"], resolvedRepoPath).trim();
  } catch {
    addCheck(state, "git.root", "fail", "Git root could not be resolved.");
    return buildResult(state.checks);
  }
  addCheck(state, "git.root", "pass", "Git root resolved.", {
    path: displayRelativePath(gitRoot, gitRoot),
  });

  let baseIsValid = true;
  try {
    validateRevision(options.baseRef, "base");
  } catch {
    baseIsValid = false;
    addCheck(state, "git.base-ref", "fail", "Base ref is invalid.");
  }

  let headIsValid = true;
  try {
    validateRevision(options.headRef, "head");
  } catch {
    headIsValid = false;
    addCheck(state, "git.head-ref", "fail", "Head ref is invalid.");
  }

  const baseExists = baseIsValid && refExists(gitRoot, options.baseRef);
  if (baseIsValid) {
    addCheck(
      state,
      "git.base-ref",
      baseExists ? "pass" : "fail",
      baseExists ? `Base ref exists: ${options.baseRef}.` : `Base ref not found: ${options.baseRef}.`,
      { ref: options.baseRef },
    );
  }

  const headExists = headIsValid && refExists(gitRoot, options.headRef);
  if (headIsValid) {
    addCheck(
      state,
      "git.head-ref",
      headExists ? "pass" : "fail",
      headExists ? `Head ref exists: ${options.headRef}.` : `Head ref not found: ${options.headRef}.`,
      { ref: options.headRef },
    );
  }

  if (baseExists && headExists) {
    const mergeBase = findMergeBase(gitRoot, options.baseRef, options.headRef);
    addCheck(
      state,
      "git.merge-base",
      mergeBase === undefined ? "fail" : "pass",
      mergeBase === undefined ? "Merge base not found." : "Merge base found.",
    );
  } else {
    addCheck(state, "git.merge-base", "fail", "Merge base skipped because a ref is unavailable.");
  }

  const isShallow = detectShallowRepository(gitRoot);
  addCheck(
    state,
    "git.shallow",
    isShallow === true ? "warn" : "pass",
    isShallow === undefined
      ? "Repository shallow status could not be determined."
      : isShallow
        ? "Repository appears shallow. If merge-base fails in CI, use fetch-depth: 0."
        : "Repository is not shallow.",
    isShallow === undefined ? undefined : { shallow: isShallow },
  );

  addConfigChecks(state, options, resolvedRepoPath);
  addEvidenceChecks(state, gitRoot);

  return buildResult(state.checks);
}

function statusLabel(status: DoctorResult["status"]): string {
  if (status === "ok") return "OK";
  if (status === "warning") return "Warning";
  return "Error";
}

function checkLabel(status: DoctorStatus): string {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}

export function renderDoctorText(result: DoctorResult): string {
  const lines = ["PR Nutrition Doctor", "", `Status: ${statusLabel(result.status)}`, "", "Checks"];

  for (const entry of result.checks) {
    lines.push(`- [${checkLabel(entry.status)}] ${entry.message}`);
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }

  if (result.errors.length > 0) {
    lines.push("", "Errors");
    for (const error of result.errors) lines.push(`- ${error}`);
  }

  return `${lines.join("\n")}\n`;
}

export function renderDoctorJson(result: DoctorResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

import { execFileSync } from "node:child_process";
import type { ChangedFile, FileStatus } from "./types.js";

const MAX_GIT_OUTPUT = 50 * 1024 * 1024;

interface StatusData {
  status: FileStatus;
  previousPath?: string;
}

interface NumstatData {
  path: string;
  previousPath?: string;
  additions: number;
  deletions: number;
  isBinary: boolean;
}

export interface GitDiffResult {
  files: ChangedFile[];
  mergeBase: string;
  warnings: string[];
}

function validateRevision(value: string, name: string): void {
  const hasControlCharacter = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (value.length === 0 || value.length > 1024 || value.startsWith("-") || hasControlCharacter) {
    throw new Error(`Invalid ${name} revision`);
  }
}

function runGit(args: string[], cwd: string, input?: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
    maxBuffer: MAX_GIT_OUTPUT,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export function getGitDiff(baseRef: string, headRef: string, cwd: string): GitDiffResult {
  validateRevision(baseRef, "base");
  validateRevision(headRef, "head");

  let mergeBase: string;
  try {
    mergeBase = runGit(["merge-base", baseRef, headRef], cwd).trim();
  } catch (error) {
    throw new Error(`Failed to find merge base between ${baseRef} and ${headRef}`, { cause: error });
  }

  if (mergeBase.length === 0) {
    throw new Error(`Failed to find merge base between ${baseRef} and ${headRef}`);
  }

  let nameStatusOutput: string;
  let numstatOutput: string;
  try {
    nameStatusOutput = runGit(["diff", "--name-status", "--find-renames", "-z", mergeBase, headRef], cwd);
    numstatOutput = runGit(["diff", "--numstat", "--find-renames", "-z", mergeBase, headRef], cwd);
  } catch (error) {
    throw new Error("Failed to read Git diff metadata", { cause: error });
  }

  const statuses = parseNameStatus(nameStatusOutput);
  const stats = parseNumstat(numstatOutput);
  const warnings: string[] = [];
  let generatedPaths = new Set<string>();

  if (stats.length > 0) {
    try {
      const input = `${stats.map((stat) => stat.path).join("\0")}\0`;
      const attributeOutput = runGit(["check-attr", "-z", "--stdin", "linguist-generated"], cwd, input);
      generatedPaths = parseCheckAttr(attributeOutput);
    } catch {
      warnings.push("Could not inspect linguist-generated attributes");
    }
  }

  const files = stats
    .map((stat): ChangedFile => {
      const statusData = statuses.get(stat.path);
      const previousPath = statusData?.previousPath ?? stat.previousPath;
      const file: ChangedFile = {
        path: stat.path,
        status: statusData?.status ?? "modified",
        additions: stat.additions,
        deletions: stat.deletions,
        isBinary: stat.isBinary,
        isGenerated: generatedPaths.has(stat.path),
        isLowValue: false,
      };
      if (previousPath !== undefined) file.previousPath = previousPath;
      return file;
    })
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  return { files, mergeBase, warnings };
}

function parseNameStatus(output: string): Map<string, StatusData> {
  const result = new Map<string, StatusData>();
  const parts = output.split("\0");

  for (let index = 0; index < parts.length - 1; ) {
    const statusText = parts[index++];
    if (!statusText) continue;
    const code = statusText.charAt(0);

    if (code === "R" || code === "C") {
      const previousPath = parts[index++];
      const path = parts[index++];
      if (path && previousPath) {
        result.set(path, { status: code === "R" ? "renamed" : "copied", previousPath });
      }
      continue;
    }

    const path = parts[index++];
    if (!path) continue;
    const status: FileStatus =
      code === "A"
        ? "added"
        : code === "M" || code === "T"
          ? "modified"
          : code === "D"
            ? "deleted"
            : "unknown";
    result.set(path, { status });
  }

  return result;
}

function parseNumstat(output: string): NumstatData[] {
  const result: NumstatData[] = [];
  const parts = output.split("\0");

  for (let index = 0; index < parts.length - 1; index++) {
    const chunk = parts[index];
    if (!chunk) continue;
    const [additionsText, deletionsText, initialPath] = chunk.split("\t");
    if (additionsText === undefined || deletionsText === undefined || initialPath === undefined) continue;

    let path = initialPath;
    let previousPath: string | undefined;
    if (path === "") {
      previousPath = parts[++index];
      path = parts[++index] ?? "";
    }
    if (path.length === 0) continue;

    const isBinary = additionsText === "-" || deletionsText === "-";
    const stat: NumstatData = {
      path,
      additions: isBinary ? 0 : Number.parseInt(additionsText, 10),
      deletions: isBinary ? 0 : Number.parseInt(deletionsText, 10),
      isBinary,
    };
    if (previousPath !== undefined) stat.previousPath = previousPath;
    result.push(stat);
  }

  return result;
}

function parseCheckAttr(output: string): Set<string> {
  const result = new Set<string>();
  const parts = output.split("\0");
  for (let index = 0; index < parts.length - 1; index += 3) {
    const path = parts[index];
    const value = parts[index + 2];
    if (path && value === "true") result.add(path);
  }
  return result;
}

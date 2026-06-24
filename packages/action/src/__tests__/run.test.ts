import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatActionError,
  resolveRefs,
  runAction,
} from "../run.js";
import type { ActionIO } from "../run.js";

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitAll(repoPath: string, message: string): void {
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", message]);
}

function createRepository(repoPath: string): { baseSha: string; headSha: string } {
  git(repoPath, ["init", "-b", "main"]);
  git(repoPath, ["config", "user.name", "PR Nutrition Test"]);
  git(repoPath, ["config", "user.email", "test@example.com"]);
  writeFileSync(join(repoPath, "README.md"), "initial\n", "utf8");
  commitAll(repoPath, "initial");
  const baseSha = git(repoPath, ["rev-parse", "HEAD"]);
  writeFileSync(join(repoPath, "app.ts"), "export const value = 1;\n", "utf8");
  commitAll(repoPath, "change");
  return { baseSha, headSha: git(repoPath, ["rev-parse", "HEAD"]) };
}

function createIO(inputs: Record<string, string> = {}): {
  io: ActionIO;
  outputs: Map<string, string | number>;
  warnings: string[];
} {
  const outputs = new Map<string, string | number>();
  const warnings: string[] = [];
  return {
    io: {
      getInput: (name) => inputs[name] ?? "",
      setOutput: (name, value) => outputs.set(name, value),
      warning: (message) => warnings.push(message),
    },
    outputs,
    warnings,
  };
}

describe("read-only GitHub Action", () => {
  let tempPath: string;
  let repoPath: string;
  let baseSha: string;
  let headSha: string;

  beforeEach(() => {
    tempPath = mkdtempSync(join(tmpdir(), "pr-nutrition-action-test-"));
    repoPath = join(tempPath, "repo");
    mkdirSync(repoPath);
    ({ baseSha, headSha } = createRepository(repoPath));
  });

  afterEach(() => {
    rmSync(tempPath, { recursive: true, force: true });
  });

  it("prefers complete explicit refs over pull request event metadata", async () => {
    const eventPath = join(tempPath, "event.json");
    writeFileSync(eventPath, JSON.stringify({
      pull_request: { base: { sha: "wrong-base" }, head: { sha: "wrong-head" } },
    }));
    const { io } = createIO({
      "base-ref": baseSha,
      "head-ref": headSha,
      "repo-path": repoPath,
      "output-directory": join(tempPath, "output"),
      "write-step-summary": "false",
    });

    const result = await runAction(io, {
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
    });

    expect(result.analysis.comparison.baseRef).toBe(baseSha);
    expect(result.analysis.comparison.headRef).toBe(headSha);
  });

  it("uses pull request event base and head SHAs when explicit refs are absent", async () => {
    const eventPath = join(tempPath, "event.json");
    writeFileSync(eventPath, JSON.stringify({
      pull_request: { base: { sha: baseSha }, head: { sha: headSha } },
    }));
    const { io } = createIO({
      "repo-path": repoPath,
      "output-directory": join(tempPath, "output"),
      "write-step-summary": "false",
    });

    const result = await runAction(io, {
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
    });

    expect(result.analysis.comparison).toMatchObject({ baseRef: baseSha, headRef: headSha });
  });

  it("rejects a single explicit ref", () => {
    expect(() => resolveRefs("main", "", { eventName: "pull_request" })).toThrow(
      "must be provided together",
    );
  });

  it("rejects a non-PR event without complete explicit refs", () => {
    expect(() => resolveRefs("", "", { eventName: "push" })).toThrow(
      "Provide both 'base-ref' and 'head-ref' for non-PR events",
    );
  });

  it("explains missing merge-base history without fetching it", async () => {
    const tree = git(repoPath, ["rev-parse", "HEAD^{tree}"]);
    const orphanCommit = git(repoPath, ["commit-tree", tree, "-m", "orphan"]);
    git(repoPath, ["update-ref", "refs/heads/orphan", orphanCommit]);
    const { io } = createIO({
      "base-ref": "main",
      "head-ref": "orphan",
      "repo-path": repoPath,
      "output-directory": join(tempPath, "output"),
      "write-step-summary": "false",
    });

    const error = await runAction(io, {}).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(formatActionError(error)).toContain("actions/checkout uses fetch-depth: 0");
    expect(formatActionError(error)).toContain("does not fetch Git history");
  });

  it("writes Markdown and JSON files to the default runner directory", async () => {
    const { io } = createIO({
      "base-ref": baseSha,
      "head-ref": headSha,
      "repo-path": repoPath,
      "write-step-summary": "false",
    });

    const result = await runAction(io, { RUNNER_TEMP: tempPath });

    expect(result.markdownPath).toBe(join(tempPath, "pr-nutrition", "pr-nutrition.md"));
    expect(readFileSync(result.markdownPath, "utf8")).toContain("# PR Nutrition");
    expect(JSON.parse(readFileSync(result.jsonPath, "utf8"))).toMatchObject({
      schemaVersion: 1,
      summary: { filesChanged: 1 },
    });
  });

  it("appends the Markdown report to the step summary", async () => {
    const summaryPath = join(tempPath, "step-summary.md");
    const { io } = createIO({
      "base-ref": baseSha,
      "head-ref": headSha,
      "repo-path": repoPath,
      "output-directory": join(tempPath, "output"),
    });

    await runAction(io, { GITHUB_STEP_SUMMARY: summaryPath });

    expect(readFileSync(summaryPath, "utf8")).toContain("**Risk:**");
  });

  it("sets all stable Action outputs", async () => {
    const outputDirectory = join(tempPath, "output");
    const { io, outputs } = createIO({
      "base-ref": baseSha,
      "head-ref": headSha,
      "repo-path": repoPath,
      "output-directory": outputDirectory,
      "write-step-summary": "false",
    });

    const result = await runAction(io, {});

    expect(Object.fromEntries(outputs)).toEqual({
      "risk-score": String(result.analysis.risk.score),
      "risk-level": result.analysis.risk.level,
      "files-changed": "1",
      "markdown-path": join(outputDirectory, "pr-nutrition.md"),
      "json-path": join(outputDirectory, "pr-nutrition.json"),
    });
  });

  it("surfaces analyzer and missing-summary warnings", async () => {
    writeFileSync(join(repoPath, "package.json"), "{invalid\n", "utf8");
    commitAll(repoPath, "add malformed package manifest");
    const { io, warnings } = createIO({
      "base-ref": headSha,
      "head-ref": "HEAD",
      "repo-path": repoPath,
      "output-directory": join(tempPath, "output"),
    });

    await runAction(io, {});

    expect(warnings).toContain("package.json is malformed or unreadable");
    expect(warnings).toContain("GITHUB_STEP_SUMMARY is unavailable; skipped the step summary");
  });
});

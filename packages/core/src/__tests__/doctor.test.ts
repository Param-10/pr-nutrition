import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderDoctorJson, renderDoctorText, runDoctor } from "../doctor.js";

const temporaryPaths: string[] = [];

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createRepository(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "pr-nutrition-doctor-"));
  temporaryPaths.push(repoPath);
  git(repoPath, ["init", "-b", "main"]);
  git(repoPath, ["config", "user.name", "PR Nutrition Test"]);
  git(repoPath, ["config", "user.email", "test@pr-nutrition.local"]);
  return repoPath;
}

function write(repoPath: string, relativePath: string, contents: string | Buffer): void {
  const fullPath = join(repoPath, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, contents);
}

function commit(repoPath: string, message: string): void {
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", message]);
}

function createCommittedRepository(): string {
  const repoPath = createRepository();
  write(repoPath, "README.md", "base\n");
  commit(repoPath, "base");
  return repoPath;
}

function checkStatuses(result: ReturnType<typeof runDoctor>): Map<string, string> {
  return new Map(result.checks.map((check) => [check.id, check.status]));
}

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("doctor", () => {
  it("passes in a valid repository and reports stable check IDs", () => {
    const repoPath = createCommittedRepository();
    write(repoPath, "package.json", JSON.stringify({ scripts: { test: "vitest", typecheck: "tsc" } }));
    write(repoPath, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
    write(repoPath, ".github/workflows/ci.yml", "name: CI\n");

    const result = runDoctor({ repoPath, baseRef: "main", headRef: "HEAD" });

    expect(result.status).toBe("ok");
    expect(result.errors).toEqual([]);
    expect(result.checks.map((check) => check.id)).toEqual([
      "git.available",
      "repo.path",
      "git.repository",
      "git.root",
      "git.base-ref",
      "git.head-ref",
      "git.merge-base",
      "git.shallow",
      "config.discovery",
      "config.validation",
      "evidence.package-manifest",
      "evidence.package-manager",
      "evidence.test-script",
      "evidence.typecheck-script",
      "evidence.ci-workflow",
    ]);
    expect(checkStatuses(result).get("evidence.package-manager")).toBe("pass");
    expect(result.checks.find((check) => check.id === "evidence.package-manager")?.message).toContain("pnpm");
  });

  it("returns an error result for invalid repo paths and non-directories", () => {
    const missing = runDoctor({ repoPath: "/definitely/not/a/repo", baseRef: "main", headRef: "HEAD" });
    expect(missing.status).toBe("error");
    expect(checkStatuses(missing).get("repo.path")).toBe("fail");

    const repoPath = createRepository();
    write(repoPath, "not-a-dir", "content\n");
    const filePath = join(repoPath, "not-a-dir");
    const notDirectory = runDoctor({ repoPath: filePath, baseRef: "main", headRef: "HEAD" });
    expect(notDirectory.status).toBe("error");
    expect(notDirectory.errors).toContain("Repository path is not a directory.");
  });

  it("reports missing refs and missing merge bases as blocking errors", () => {
    const repoPath = createCommittedRepository();
    const missingBase = runDoctor({ repoPath, baseRef: "missing", headRef: "HEAD" });
    expect(missingBase.status).toBe("error");
    expect(missingBase.errors).toContain("Base ref not found: missing.");

    const missingHead = runDoctor({ repoPath, baseRef: "main", headRef: "missing" });
    expect(missingHead.status).toBe("error");
    expect(missingHead.errors).toContain("Head ref not found: missing.");

    git(repoPath, ["checkout", "--orphan", "unrelated"]);
    git(repoPath, ["rm", "-rf", "."]);
    write(repoPath, "unrelated.txt", "unrelated\n");
    commit(repoPath, "unrelated");

    const noMergeBase = runDoctor({ repoPath, baseRef: "main", headRef: "unrelated" });
    expect(noMergeBase.status).toBe("error");
    expect(noMergeBase.errors).toContain("Merge base not found.");
  });

  it("warns for shallow repositories without failing when the merge base is available", () => {
    const sourceRepo = createCommittedRepository();
    const clonePath = mkdtempSync(join(tmpdir(), "pr-nutrition-doctor-shallow-"));
    rmSync(clonePath, { recursive: true, force: true });
    temporaryPaths.push(clonePath);
    execFileSync("git", ["clone", "--depth", "1", `file://${sourceRepo}`, clonePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const result = runDoctor({ repoPath: clonePath, baseRef: "HEAD", headRef: "HEAD" });

    expect(result.status).toBe("warning");
    expect(checkStatuses(result).get("git.shallow")).toBe("warn");
    expect(result.errors).toEqual([]);
  });

  it("handles valid, missing, disabled, and invalid configs", () => {
    const repoPath = createCommittedRepository();
    write(repoPath, ".pr-nutrition.json", JSON.stringify({ schemaVersion: 1 }));
    expect(runDoctor({ repoPath, baseRef: "main", headRef: "HEAD" }).status).toBe("ok");

    const missing = runDoctor({
      repoPath,
      baseRef: "main",
      headRef: "HEAD",
      configFile: "missing.json",
    });
    expect(missing.status).toBe("error");
    expect(checkStatuses(missing).get("config.validation")).toBe("fail");

    write(repoPath, ".pr-nutrition.json", "{not json");
    const disabled = runDoctor({ repoPath, baseRef: "main", headRef: "HEAD", useConfig: false });
    expect(disabled.status).toBe("ok");
    expect(disabled.checks.find((check) => check.id === "config.discovery")?.message).toContain("disabled");

    const invalid = runDoctor({ repoPath, baseRef: "main", headRef: "HEAD" });
    expect(invalid.status).toBe("error");
    expect(invalid.errors.join("\n")).toContain("not valid JSON");
  });

  it("preserves config safety protections", () => {
    const repoPath = createCommittedRepository();
    write(repoPath, "real-config.json", JSON.stringify({ schemaVersion: 1 }));
    symlinkSync(join(repoPath, "real-config.json"), join(repoPath, ".pr-nutrition.json"));
    expect(runDoctor({ repoPath, baseRef: "main", headRef: "HEAD" }).errors.join("\n")).toContain(
      "symbolic link",
    );

    rmSync(join(repoPath, ".pr-nutrition.json"));
    const outsideDir = mkdtempSync(join(tmpdir(), "pr-nutrition-doctor-outside-"));
    temporaryPaths.push(outsideDir);
    write(outsideDir, ".pr-nutrition.json", JSON.stringify({ schemaVersion: 1 }));
    symlinkSync(outsideDir, join(repoPath, "configs"));
    expect(
      runDoctor({
        repoPath,
        baseRef: "main",
        headRef: "HEAD",
        configFile: "configs/.pr-nutrition.json",
      }).errors.join("\n"),
    ).toContain("symbolic link directory");

    const outside = runDoctor({
      repoPath,
      baseRef: "main",
      headRef: "HEAD",
      configFile: "../outside.json",
    });
    expect(outside.errors.join("\n")).toContain("inside the repository");

    const largeRepo = createCommittedRepository();
    write(largeRepo, ".pr-nutrition.json", `{"schemaVersion":1,"padding":"${"x".repeat(64 * 1024)}"}`);
    expect(runDoctor({ repoPath: largeRepo, baseRef: "main", headRef: "HEAD" }).errors.join("\n")).toContain(
      "64 KiB limit",
    );
  });

  it("renders clean JSON and text without source, patch, env, or absolute-path leakage", () => {
    const repoPath = createCommittedRepository();
    write(repoPath, ".env.production", "SECRET_DO_NOT_PRINT=value\n");
    const result = runDoctor({ repoPath, baseRef: "main", headRef: "HEAD" });
    const json = renderDoctorJson(result);
    const text = renderDoctorText(result);

    expect(JSON.parse(json)).toMatchObject({ schemaVersion: 1, command: "doctor" });
    expect(json).not.toContain(repoPath);
    expect(json).not.toContain("SECRET_DO_NOT_PRINT");
    expect(json).not.toContain("@@");
    expect(text).toContain("PR Nutrition Doctor");
    expect(text).toContain("Status: OK");
    expect(text).not.toContain("SECRET_DO_NOT_PRINT");
    expect(text).not.toContain("@@");
  });
});

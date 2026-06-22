import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzePullRequest } from "../analyzer.js";
import { calculateRisk } from "../scorer.js";
import type { AreaClassification, RiskAreaId } from "../types.js";

const repositories: string[] = [];

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createRepository(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "pr-nutrition-core-"));
  repositories.push(repoPath);
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

function areas(...ids: RiskAreaId[]): AreaClassification[] {
  return ids.map((id) => ({ id, label: id, files: [`${id}.txt`] }));
}

afterEach(() => {
  for (const repoPath of repositories.splice(0)) {
    rmSync(repoPath, { recursive: true, force: true });
  }
});

describe("core analyzer", () => {
  it("returns the public schema and category risk only once", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "feature"]);

    write(repoPath, "api/users.ts", "export const users = [];\n");
    write(repoPath, "api/projects.ts", "export const projects = [];\n");
    write(repoPath, "src/auth/login.ts", "export const login = true;\n");
    write(repoPath, "src/auth/login.test.ts", "test(\"login\", () => {});\n");
    commit(repoPath, "feature");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "feature" });

    expect(result.schemaVersion).toBe(1);
    expect(result.comparison).toMatchObject({ repoPath, baseRef: "main", headRef: "feature" });
    expect(result.comparison.mergeBase).toMatch(/^[0-9a-f]{40}$/);
    expect(result.summary.filesChanged).toBe(4);
    expect(result.areas.map((area) => area.id)).toEqual(["authentication", "api"]);
    expect(result.areas.find((area) => area.id === "api")?.files).toEqual([
      "api/projects.ts",
      "api/users.ts",
    ]);
    expect(result.risk).toMatchObject({ score: 40, level: "medium" });
    expect(result.risk.reasons.filter((reason) => reason.points === 15)).toHaveLength(1);
    expect(result.evidence.hasChangedTests).toBe(true);
    expect(result.reviewFocus).toHaveLength(2);
  });

  it("uses the merge base so base-only changes are excluded", async () => {
    const repoPath = createRepository();
    write(repoPath, "shared.txt", "base\n");
    commit(repoPath, "shared base");

    git(repoPath, ["checkout", "-b", "feature"]);
    write(repoPath, "feature.ts", "export const feature = true;\n");
    commit(repoPath, "feature change");

    git(repoPath, ["checkout", "main"]);
    write(repoPath, "base-only.ts", "export const baseOnly = true;\n");
    commit(repoPath, "base-only change");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "feature" });
    expect(result.files.map((file) => file.path)).toEqual(["feature.ts"]);
  });

  it("handles empty diffs", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "main" });
    expect(result.summary).toEqual({
      filesChanged: 0,
      additions: 0,
      deletions: 0,
      reviewableFiles: 0,
      reviewableLines: 0,
    });
    expect(result.files).toEqual([]);
    expect(result.areas).toEqual([]);
    expect(result.risk).toEqual({ score: 0, level: "low", reasons: [] });
  });

  it("preserves rename, binary, deletion, and unusual-filename metadata", async () => {
    const repoPath = createRepository();
    write(repoPath, "old name.txt", "rename me\n");
    write(repoPath, "deleted.txt", "remove me\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "feature"]);

    git(repoPath, ["mv", "old name.txt", "new name.txt"]);
    git(repoPath, ["rm", "deleted.txt"]);
    write(repoPath, "binary.png", Buffer.from([0x00, 0x01, 0x02, 0xff]));
    write(repoPath, "line\nbreak.txt", "unusual\n");
    commit(repoPath, "metadata cases");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "feature" });
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "new name.txt", previousPath: "old name.txt", status: "renamed" }),
        expect.objectContaining({ path: "deleted.txt", status: "deleted", deletions: 1 }),
        expect.objectContaining({ path: "binary.png", status: "added", isBinary: true }),
        expect.objectContaining({ path: "line\nbreak.txt", status: "added" }),
      ]),
    );
  });

  it("excludes generated and low-review-value files from size totals", async () => {
    const repoPath = createRepository();
    write(repoPath, ".gitattributes", "vendor.js linguist-generated=true\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "feature"]);

    write(repoPath, "vendor.js", "generated\n".repeat(250));
    write(repoPath, "dist/bundle.js", "built\n".repeat(250));
    write(repoPath, "packages/app/pnpm-lock.yaml", "lockfileVersion: '9.0'\n".repeat(250));
    write(repoPath, "src/index.ts", "export const value = 1;\n");
    commit(repoPath, "generated output");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "feature" });
    expect(result.summary.reviewableFiles).toBe(1);
    expect(result.summary.reviewableLines).toBe(1);
    expect(result.risk.score).toBe(15);
    expect(result.lowReviewValueFiles.map((file) => file.path)).toEqual([
      "dist/bundle.js",
      "packages/app/pnpm-lock.yaml",
      "vendor.js",
    ]);
    expect(result.lowReviewValueFiles.find((file) => file.path === "vendor.js")?.isGenerated).toBe(true);
  });

  it("detects repository evidence without executing scripts", async () => {
    const repoPath = createRepository();
    write(
      repoPath,
      "package.json",
      JSON.stringify({ scripts: { test: "vitest", typecheck: "tsc", postinstall: "do-not-run" } }),
    );
    write(repoPath, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
    write(repoPath, "pyproject.toml", "[project]\nname = 'demo'\n");
    write(repoPath, ".github/workflows/ci.yml", "name: CI\n");
    commit(repoPath, "base");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "main" });
    expect(result.evidence).toEqual({
      hasChangedTests: false,
      hasChangedDocs: false,
      hasPackageManifest: true,
      manifests: ["package.json", "pyproject.toml"],
      packageManager: "pnpm",
      hasTestScript: true,
      hasTypecheckScript: true,
      hasCiWorkflow: true,
    });
  });

  it("warns about malformed package.json instead of failing", async () => {
    const repoPath = createRepository();
    write(repoPath, "package.json", "{invalid");
    commit(repoPath, "base");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "main" });
    expect(result.evidence.hasPackageManifest).toBe(true);
    expect(result.evidence.hasTestScript).toBe(false);
    expect(result.warnings).toContain("package.json is malformed or unreadable");
  });

  it("does not follow a package.json symlink", async () => {
    const repoPath = createRepository();
    write(repoPath, "private.json", JSON.stringify({ scripts: { test: "DO_NOT_INSPECT" } }));
    symlinkSync("private.json", join(repoPath, "package.json"));
    commit(repoPath, "symlinked manifest");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "main" });
    expect(result.evidence.hasPackageManifest).toBe(true);
    expect(result.evidence.hasTestScript).toBe(false);
    expect(result.warnings).toContain("package.json is not a regular file and was not inspected");
    expect(JSON.stringify(result)).not.toContain("DO_NOT_INSPECT");
  });

  it("never exposes environment-file contents", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "feature"]);
    write(repoPath, ".env.production", "SUPER_SECRET_DO_NOT_EXPOSE=correct-horse-battery-staple\n");
    commit(repoPath, "environment path");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "feature" });
    expect(JSON.stringify(result)).not.toContain("correct-horse-battery-staple");
    expect(result.areas.map((area) => area.id)).toContain("configuration");
  });

  it("does not flag documentation-only changes as missing tests", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "docs"]);
    write(repoPath, "README.md", "base\nmore docs\n");
    commit(repoPath, "docs");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "docs" });
    expect(result.evidence.hasChangedDocs).toBe(true);
    expect(result.reviewFocus).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("caps review focus at five deterministic priority items", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "feature"]);
    write(repoPath, "migrations/001.sql", "create table demo(id int);\n");
    write(repoPath, "auth/login.ts", "export const login = true;\n");
    write(repoPath, ".github/workflows/ci.yml", "name: CI\n");
    write(repoPath, "openapi.yaml", "openapi: 3.0.0\n");
    write(repoPath, "package.json", "{}\n");
    write(repoPath, "config/app.json", "{}\n");
    commit(repoPath, "all risk areas");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "feature" });
    expect(result.areas).toHaveLength(6);
    expect(result.risk.score).toBe(100);
    expect(result.risk.level).toBe("high");
    expect(result.reviewFocus).toHaveLength(5);
    expect(result.reviewFocus[0]).toMatch(/migration/i);
  });

  it("rejects missing refs and option-like revisions", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");

    await expect(
      analyzePullRequest({ repoPath, baseRef: "missing", headRef: "HEAD" }),
    ).rejects.toThrow(/Failed to find merge base/);
    await expect(
      analyzePullRequest({ repoPath, baseRef: "--help", headRef: "HEAD" }),
    ).rejects.toThrow(/Invalid base revision/);
    await expect(
      analyzePullRequest({ repoPath, baseRef: "main", headRef: "HEAD\nmain" }),
    ).rejects.toThrow(/Invalid head revision/);
  });
});

describe("risk scoring boundaries", () => {
  it("uses low 0-19, medium 20-49, and high 50-100", () => {
    expect(calculateRisk(0, 0, areas("api"))).toMatchObject({ score: 15, level: "low" });
    expect(calculateRisk(0, 0, areas("ci"))).toMatchObject({ score: 20, level: "medium" });
    expect(calculateRisk(0, 0, areas("migrations", "ci"))).toMatchObject({
      score: 50,
      level: "high",
    });
    expect(
      calculateRisk(
        30,
        800,
        areas("migrations", "authentication", "ci", "api", "dependencies", "configuration"),
      ),
    ).toMatchObject({ score: 100, level: "high" });
  });

  it("applies exactly one size band", () => {
    expect(calculateRisk(9, 199, [])).toMatchObject({ score: 0, level: "low" });
    expect(calculateRisk(10, 0, [])).toMatchObject({ score: 10, level: "low" });
    expect(calculateRisk(0, 200, [])).toMatchObject({ score: 10, level: "low" });
    expect(calculateRisk(30, 0, [])).toMatchObject({ score: 20, level: "medium" });
    expect(calculateRisk(0, 800, [])).toMatchObject({ score: 20, level: "medium" });
  });
});

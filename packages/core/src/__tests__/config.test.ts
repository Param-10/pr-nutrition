import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzePullRequest } from "../analyzer.js";
import { createConfigMatcher, loadAnalysisConfig, validateAnalysisConfig } from "../config.js";
import type { AnalysisConfig } from "../types.js";

const temporaryPaths: string[] = [];

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createRepository(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "pr-nutrition-config-"));
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

function createChangedRepository(paths: string[]): string {
  const repoPath = createRepository();
  write(repoPath, "README.md", "base\n");
  commit(repoPath, "base");
  for (const path of paths) {
    write(repoPath, path, "changed contents\n");
  }
  commit(repoPath, "head");
  return repoPath;
}

const FULL_CONFIG: AnalysisConfig = {
  schemaVersion: 1,
  paths: {
    generated: ["src/generated/**"],
    lowReviewValue: ["snapshots/**"],
    tests: ["spec/**"],
    docs: ["handbook/**"],
    risk: {
      authentication: ["modules/identity/**"],
      api: ["contracts/**"],
      configuration: ["deploy/env/**"],
    },
  },
};

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("validateAnalysisConfig", () => {
  it("accepts a minimal config", () => {
    expect(validateAnalysisConfig({ schemaVersion: 1 })).toEqual({ schemaVersion: 1 });
  });

  it("accepts a full config", () => {
    expect(validateAnalysisConfig(FULL_CONFIG)).toEqual(FULL_CONFIG);
  });

  it("rejects a missing schema version", () => {
    expect(() => validateAnalysisConfig({})).toThrow("'schemaVersion' is required");
  });

  it("rejects an unsupported schema version", () => {
    expect(() => validateAnalysisConfig({ schemaVersion: 2 })).toThrow("unsupported 'schemaVersion'");
  });

  it("rejects a non-object config", () => {
    expect(() => validateAnalysisConfig([1])).toThrow("must be a JSON object");
    expect(() => validateAnalysisConfig(null)).toThrow("must be a JSON object");
  });

  it("rejects an unknown top-level key", () => {
    expect(() => validateAnalysisConfig({ schemaVersion: 1, weights: {} })).toThrow(
      "unknown top-level key 'weights'",
    );
  });

  it("rejects an unknown paths key", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { ignored: ["a/**"] } }),
    ).toThrow("unknown key 'ignored'");
  });

  it("rejects a non-object paths value", () => {
    expect(() => validateAnalysisConfig({ schemaVersion: 1, paths: ["a/**"] })).toThrow(
      "'paths' must be an object",
    );
  });

  it("rejects an unknown risk area", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { risk: { secrets: ["a/**"] } } }),
    ).toThrow("unknown risk area 'secrets'");
  });

  it("rejects a non-object risk value", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { risk: ["a/**"] } }),
    ).toThrow("'paths.risk' must be an object");
  });

  it("rejects a non-array pattern group", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { generated: "src/generated/**" } }),
    ).toThrow("'paths.generated' must be an array");
  });

  it("rejects a non-string array entry", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { docs: [42] } }),
    ).toThrow("'paths.docs' entries must be strings");
  });

  it("rejects an empty pattern", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { tests: [""] } }),
    ).toThrow("must not be empty");
  });

  it("rejects a backslash pattern", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { tests: ["spec\\unit\\**"] } }),
    ).toThrow("POSIX forward slashes");
  });

  it("rejects a control-character pattern", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { tests: ["spec/\u0007/**"] } }),
    ).toThrow("control characters");
  });

  it("rejects a parent traversal pattern", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { tests: ["../outside/**"] } }),
    ).toThrow("must not traverse parent directories");
  });

  it("rejects an invalid glob", () => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { tests: ["spec/[unclosed"] } }),
    ).toThrow("not a valid glob");
  });

  it.each([
    ["["],
    ["]"],
    ["{"],
    ["spec/[unclosed"],
  ])("rejects invalid glob pattern %s", (pattern) => {
    expect(() =>
      validateAnalysisConfig({ schemaVersion: 1, paths: { tests: [pattern] } }),
    ).toThrow("not a valid glob");
  });

  it("accepts a lone closing brace as a literal glob", () => {
    expect(validateAnalysisConfig({ schemaVersion: 1, paths: { tests: ["}"] } })).toEqual({
      schemaVersion: 1,
      paths: { tests: ["}"] },
    });
  });
});

describe("loadAnalysisConfig", () => {
  it("returns undefined when the discovered config is missing", () => {
    const repoPath = createRepository();
    expect(loadAnalysisConfig({ repoPath })).toBeUndefined();
  });

  it("loads a valid discovered config", () => {
    const repoPath = createRepository();
    write(repoPath, ".pr-nutrition.json", JSON.stringify(FULL_CONFIG));
    expect(loadAnalysisConfig({ repoPath })).toEqual(FULL_CONFIG);
  });

  it("fails clearly when the discovered config is invalid", () => {
    const repoPath = createRepository();
    write(repoPath, ".pr-nutrition.json", "{not json");
    expect(() => loadAnalysisConfig({ repoPath })).toThrow("not valid JSON");
  });

  it("returns undefined when config loading is disabled", () => {
    const repoPath = createRepository();
    write(repoPath, ".pr-nutrition.json", "{not json");
    expect(loadAnalysisConfig({ repoPath, useConfig: false })).toBeUndefined();
  });

  it("loads an explicit config file", () => {
    const repoPath = createRepository();
    write(repoPath, "configs/pr-nutrition.json", JSON.stringify({ schemaVersion: 1 }));
    expect(loadAnalysisConfig({ repoPath, configFile: "configs/pr-nutrition.json" })).toEqual({
      schemaVersion: 1,
    });
  });

  it("loads an absolute config path inside the repository", () => {
    const repoPath = createRepository();
    write(repoPath, "custom.json", JSON.stringify({ schemaVersion: 1 }));
    expect(loadAnalysisConfig({ repoPath, configFile: join(repoPath, "custom.json") })).toEqual({
      schemaVersion: 1,
    });
  });

  it("fails clearly when an explicit config file is missing", () => {
    const repoPath = createRepository();
    expect(() => loadAnalysisConfig({ repoPath, configFile: "missing.json" })).toThrow(
      "config file not found",
    );
  });

  it("rejects config paths outside the repository", () => {
    const repoPath = createRepository();
    expect(() => loadAnalysisConfig({ repoPath, configFile: "../outside.json" })).toThrow(
      "inside the repository",
    );
    expect(() => loadAnalysisConfig({ repoPath, configFile: "/etc/hosts" })).toThrow(
      "inside the repository",
    );
  });

  it("rejects a symlinked config file", () => {
    const repoPath = createRepository();
    write(repoPath, "real-config.json", JSON.stringify({ schemaVersion: 1 }));
    symlinkSync(join(repoPath, "real-config.json"), join(repoPath, ".pr-nutrition.json"));
    expect(() => loadAnalysisConfig({ repoPath })).toThrow("symbolic link");
  });

  it("rejects a config path behind a symlinked parent directory", () => {
    const repoPath = createRepository();
    const outsideDir = mkdtempSync(join(tmpdir(), "pr-nutrition-config-outside-"));
    temporaryPaths.push(outsideDir);
    write(outsideDir, ".pr-nutrition.json", JSON.stringify({ schemaVersion: 1 }));
    symlinkSync(outsideDir, join(repoPath, "configs"));
    expect(() =>
      loadAnalysisConfig({ repoPath, configFile: "configs/.pr-nutrition.json" }),
    ).toThrow("symbolic link directory");
  });

  it("rejects a config file over 64 KiB", () => {
    const repoPath = createRepository();
    const padding = "x".repeat(64 * 1024);
    write(repoPath, ".pr-nutrition.json", `{"schemaVersion":1,"padding":"${padding}"}`);
    expect(() => loadAnalysisConfig({ repoPath })).toThrow("64 KiB limit");
  });
});

describe("config glob matching", () => {
  const NEGATE_PATTERN_CONFIG: AnalysisConfig = {
    schemaVersion: 1,
    paths: { generated: ["!src/**"] },
  };

  it("accepts leading-bang patterns during validation", () => {
    expect(validateAnalysisConfig(NEGATE_PATTERN_CONFIG)).toEqual(NEGATE_PATTERN_CONFIG);
  });

  it("treats leading-bang patterns as literals, not negation", () => {
    const matcher = createConfigMatcher(NEGATE_PATTERN_CONFIG);

    expect(matcher.isGenerated("README.md")).toBe(false);
    expect(matcher.isGenerated("package.json")).toBe(false);
    expect(matcher.isGenerated("src/index.ts")).toBe(false);
    expect(matcher.isGenerated("!src/index.ts")).toBe(true);
  });

  it("does not classify ordinary paths as generated for leading-bang patterns", async () => {
    const repoPath = createChangedRepository(["README.md", "package.json", "src/index.ts"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: NEGATE_PATTERN_CONFIG,
    });

    for (const path of ["README.md", "package.json", "src/index.ts"]) {
      const file = result.files.find((entry) => entry.path === path);
      expect(file?.isGenerated).toBe(false);
    }
  });

  it("matches literal paths that begin with a bang prefix", async () => {
    const repoPath = createChangedRepository(["!src/index.ts"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: NEGATE_PATTERN_CONFIG,
    });

    const file = result.files.find((entry) => entry.path === "!src/index.ts");
    expect(file).toMatchObject({ isGenerated: true, isLowValue: true });
  });
});

describe("analysis with config", () => {
  it("treats custom generated paths as generated and low review value", async () => {
    const repoPath = createChangedRepository(["src/generated/client.ts"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: FULL_CONFIG,
    });

    const file = result.files.find((entry) => entry.path === "src/generated/client.ts");
    expect(file).toMatchObject({ isGenerated: true, isLowValue: true });
    expect(result.lowReviewValueFiles.map((entry) => entry.path)).toContain(
      "src/generated/client.ts",
    );
  });

  it("treats custom low-review-value paths as low review value", async () => {
    const repoPath = createChangedRepository(["snapshots/output.golden"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: FULL_CONFIG,
    });

    const file = result.files.find((entry) => entry.path === "snapshots/output.golden");
    expect(file).toMatchObject({ isGenerated: false, isLowValue: true });
    expect(result.summary.reviewableFiles).toBe(0);
  });

  it("counts custom test paths as changed tests evidence", async () => {
    const repoPath = createChangedRepository(["spec/login.check.rb"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: FULL_CONFIG,
    });

    expect(result.evidence.hasChangedTests).toBe(true);
  });

  it("counts custom docs paths as changed docs evidence", async () => {
    const repoPath = createChangedRepository(["handbook/guide.book"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: FULL_CONFIG,
    });

    expect(result.evidence.hasChangedDocs).toBe(true);
  });

  it("triggers authentication risk for custom auth paths", async () => {
    const repoPath = createChangedRepository(["modules/identity/session.rb"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: FULL_CONFIG,
    });

    expect(result.areas.map((area) => area.id)).toEqual(["authentication"]);
    expect(result.risk).toMatchObject({ score: 25, level: "medium" });
  });

  it("triggers api risk for custom api paths", async () => {
    const repoPath = createChangedRepository(["contracts/orders.proto"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: FULL_CONFIG,
    });

    expect(result.areas.map((area) => area.id)).toEqual(["api"]);
  });

  it("keeps built-in priority over lower-priority custom risk areas", async () => {
    const repoPath = createChangedRepository(["migrations/001-init.sql"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: {
        schemaVersion: 1,
        paths: { risk: { configuration: ["migrations/**"] } },
      },
    });

    expect(result.areas.map((area) => area.id)).toEqual(["migrations"]);
  });

  it("still applies built-in rules when config exists", async () => {
    const repoPath = createChangedRepository(["src/auth/login.ts", "pnpm-lock.yaml"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: FULL_CONFIG,
    });

    expect(result.areas.map((area) => area.id)).toEqual(["authentication", "dependencies"]);
    expect(result.lowReviewValueFiles.map((entry) => entry.path)).toContain("pnpm-lock.yaml");
  });

  it("keeps identical behavior when config is omitted", async () => {
    const repoPath = createChangedRepository(["modules/identity/session.rb"]);
    const withoutConfig = await analyzePullRequest({ repoPath, baseRef: "HEAD~1", headRef: "HEAD" });

    expect(withoutConfig.areas).toEqual([]);
    expect(withoutConfig.risk.score).toBe(0);
  });

  it("matches dot-directories and dotfiles in custom risk paths", async () => {
    const repoPath = createChangedRepository([".github/workflows/ci.yml"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: {
        schemaVersion: 1,
        paths: { risk: { ci: [".github/workflows/**"] } },
      },
    });

    expect(result.areas.map((area) => area.id)).toEqual(["ci"]);
  });

  it("matches dot-directories and dotfiles in custom docs paths", async () => {
    const repoPath = createChangedRepository([".changeset/release.md"]);
    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      config: {
        schemaVersion: 1,
        paths: { docs: [".changeset/**"] },
      },
    });

    expect(result.evidence.hasChangedDocs).toBe(true);
  });
});

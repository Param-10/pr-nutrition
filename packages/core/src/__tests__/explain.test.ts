import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { analyzePullRequest } from "../analyzer.js";
import type { AnalysisConfig, AnalysisExplanation } from "../types.js";

const temporaryPaths: string[] = [];

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createRepository(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "pr-nutrition-explain-"));
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

async function analyzeWith(
  paths: string[],
  config?: AnalysisConfig,
): Promise<AnalysisExplanation[]> {
  const repoPath = createRepository();
  write(repoPath, "seed.txt", "base\n");
  commit(repoPath, "base");
  for (const path of paths) {
    write(repoPath, path, "changed contents\n");
  }
  commit(repoPath, "head");
  const result = await analyzePullRequest({
    repoPath,
    baseRef: "HEAD~1",
    headRef: "HEAD",
    explain: true,
    ...(config === undefined ? {} : { config }),
  });
  return result.explanations ?? [];
}

function find(
  explanations: AnalysisExplanation[],
  path: string,
  kind: AnalysisExplanation["kind"],
): AnalysisExplanation | undefined {
  return explanations.find((entry) => entry.path === path && entry.kind === kind);
}

const FULL_CONFIG: AnalysisConfig = {
  schemaVersion: 1,
  paths: {
    generated: ["sdk/**"],
    lowReviewValue: ["snapshots/**"],
    tests: ["spec/**"],
    docs: ["handbook/**"],
    risk: {
      authentication: ["modules/identity/**"],
      api: ["contracts/**"],
    },
  },
};

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("built-in explanations", () => {
  let explanations: AnalysisExplanation[];

  beforeAll(async () => {
    explanations = await analyzeWith([
      "src/auth/login.ts",
      "package.json",
      "dist/bundle.js",
      "docs/guide.md",
      "src/app.test.ts",
      "pnpm-lock.yaml",
    ]);
  });

  it("explains built-in authentication risk", () => {
    const explanation = find(explanations, "src/auth/login.ts", "risk-area");
    expect(explanation).toMatchObject({
      area: "authentication",
      ruleId: "builtin.path.authentication",
      source: "builtin",
    });
    expect(explanation?.reason).toContain("authentication");
  });

  it("explains built-in dependency manifests", () => {
    expect(find(explanations, "package.json", "risk-area")).toMatchObject({
      area: "dependencies",
      ruleId: "builtin.path.dependencies",
      source: "builtin",
    });
  });

  it("explains built-in generated files", () => {
    expect(find(explanations, "dist/bundle.js", "generated")).toMatchObject({
      ruleId: "builtin.path.generated",
      source: "builtin",
    });
  });

  it("explains built-in docs and tests", () => {
    expect(find(explanations, "docs/guide.md", "docs")).toMatchObject({
      ruleId: "builtin.path.docs",
      source: "builtin",
    });
    expect(find(explanations, "src/app.test.ts", "test")).toMatchObject({
      ruleId: "builtin.path.test",
      source: "builtin",
    });
  });

  it("explains built-in low-review-value files", () => {
    expect(find(explanations, "pnpm-lock.yaml", "low-review-value")).toMatchObject({
      ruleId: "builtin.path.low-review-value",
      source: "builtin",
    });
  });

  it("sorts explanations deterministically by path", () => {
    const paths = explanations.map((entry) => entry.path);
    expect(paths).toEqual([...paths].sort());
  });
});

describe("config explanations", () => {
  let explanations: AnalysisExplanation[];

  beforeAll(async () => {
    explanations = await analyzeWith(
      [
        "sdk/client.ts",
        "snapshots/output.golden",
        "handbook/intro.adoc",
        "spec/login.rb",
        "modules/identity/session.rb",
      ],
      FULL_CONFIG,
    );
  });

  it("explains config generated paths with source config", () => {
    expect(find(explanations, "sdk/client.ts", "generated")).toMatchObject({
      ruleId: "config.paths.generated",
      source: "config",
      pattern: "sdk/**",
    });
  });

  it("explains config low-review-value paths", () => {
    expect(find(explanations, "snapshots/output.golden", "low-review-value")).toMatchObject({
      ruleId: "config.paths.lowReviewValue",
      source: "config",
      pattern: "snapshots/**",
    });
  });

  it("explains config docs and tests paths", () => {
    expect(find(explanations, "handbook/intro.adoc", "docs")).toMatchObject({
      ruleId: "config.paths.docs",
      source: "config",
    });
    expect(find(explanations, "spec/login.rb", "test")).toMatchObject({
      ruleId: "config.paths.tests",
      source: "config",
    });
  });

  it("explains config risk paths with source config", () => {
    expect(find(explanations, "modules/identity/session.rb", "risk-area")).toMatchObject({
      area: "authentication",
      ruleId: "config.paths.risk.authentication",
      source: "config",
      pattern: "modules/identity/**",
    });
  });
});

describe("priority and git explanations", () => {
  it("reports the winning built-in rule when priority beats config", async () => {
    const explanations = await analyzeWith(["migrations/001-init.sql"], {
      schemaVersion: 1,
      paths: { risk: { configuration: ["migrations/**"] } },
    });
    const explanation = find(explanations, "migrations/001-init.sql", "risk-area");
    expect(explanation).toMatchObject({
      area: "migrations",
      ruleId: "builtin.path.migrations",
      source: "builtin",
    });
    expect(explanation?.reason).toContain("ranks above configuration");
  });

  it("explains binary and renamed files", async () => {
    const repoPath = createRepository();
    write(repoPath, "src/old-name.ts", `export const value = 1;\n${"filler line\n".repeat(20)}`);
    commit(repoPath, "base");
    git(repoPath, ["mv", "src/old-name.ts", "src/new-name.ts"]);
    write(repoPath, "image.bin", Buffer.from([0, 1, 2, 0, 3, 255, 0]));
    commit(repoPath, "head");

    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      explain: true,
    });

    expect(find(result.explanations ?? [], "image.bin", "binary")).toMatchObject({
      ruleId: "builtin.git.binary",
      source: "git",
    });
    const rename = find(result.explanations ?? [], "src/new-name.ts", "rename");
    expect(rename).toMatchObject({ ruleId: "builtin.git.rename", source: "git" });
    expect(rename?.reason).toContain("renamed");
    expect(rename?.reason).toContain("src/old-name.ts");
    expect(Array.isArray(result.explanations)).toBe(true);
  });

  it("explains copied files with copy semantics", async () => {
    const repoPath = createRepository();
    write(repoPath, "src/source.ts", `export const value = 1;\n${"filler line\n".repeat(20)}`);
    commit(repoPath, "base");
    write(repoPath, "src/copied.ts", `export const value = 1;\n${"filler line\n".repeat(20)}`);
    commit(repoPath, "head");

    const result = await analyzePullRequest({
      repoPath,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      explain: true,
    });

    const copy = find(result.explanations ?? [], "src/copied.ts", "copy");
    expect(result.files).toContainEqual(
      expect.objectContaining({
        path: "src/copied.ts",
        previousPath: "src/source.ts",
        status: "copied",
      }),
    );
    expect(copy).toMatchObject({ ruleId: "builtin.git.copy", source: "git" });
    expect(copy?.reason).toContain("copied");
    expect(copy?.reason).not.toContain("renamed");
  });
});

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzePullRequest } from "../analyzer.js";
import { getRiskArea, isDocFile, isTestFile } from "../classifier.js";
import { buildFocusFileGroups } from "../focus.js";
import { calculateRisk } from "../scorer.js";
import type { AnalysisResult, AreaClassification, FocusFile, FocusFileGroupTitle, RiskAreaId } from "../types.js";

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

function areaWithFiles(id: RiskAreaId, fileCount: number): AreaClassification[] {
  return [
    { id, label: id, files: Array.from({ length: fileCount }, (_, index) => `${id}-${index}.txt`) },
  ];
}

function areaLines(entries: Partial<Record<RiskAreaId, number>>): Map<RiskAreaId, number> {
  return new Map(Object.entries(entries) as [RiskAreaId, number][]);
}

function focusGroup(result: AnalysisResult, title: FocusFileGroupTitle): FocusFile[] {
  return result.focusFiles?.find((group) => group.title === title)?.files ?? [];
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
    expect(result.risk).toMatchObject({ score: 35, level: "medium" });
    expect(
      result.risk.reasons.filter((reason) => reason.description.includes("api and public contracts")),
    ).toHaveLength(1);
    expect(result.evidence.hasChangedTests).toBe(true);
    expect(result.reviewFocus).toHaveLength(2);
    expect(result.focusFiles).toBeUndefined();
    expect(result.explanations).toBeUndefined();
  });

  it("includes explanations only when requested", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "feature"]);
    write(repoPath, "src/auth/login.ts", "export const login = true;\n");
    commit(repoPath, "feature");

    const result = await analyzePullRequest({
      repoPath,
      baseRef: "main",
      headRef: "feature",
      explain: true,
    });

    expect(result.explanations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/auth/login.ts",
          ruleId: "builtin.path.authentication",
        }),
      ]),
    );
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

  it("builds deterministic focus file groups from existing classifications", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "feature"]);

    write(repoPath, "migrations/002_add_users.sql", "create table users(id int);\n");
    write(repoPath, "src/auth/session.ts", "export const session = true;\n");
    write(repoPath, ".github/workflows/ci.yml", "name: CI\n");
    write(repoPath, "packages/api/openapi.yaml", "openapi: 3.0.0\n");
    write(repoPath, "src/user/z-profile.ts", "one\ntwo\nthree\n");
    write(repoPath, "src/user/a-profile.ts", "one\n");
    write(repoPath, "src/generated/client.ts", "export const client = true;\n");
    write(repoPath, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
    write(repoPath, "assets/logo.png", Buffer.from([0x00, 0x01, 0x02, 0xff]));
    commit(repoPath, "focus files");

    const result = await analyzePullRequest({
      repoPath,
      baseRef: "main",
      headRef: "feature",
      focusFiles: true,
    });

    expect(result.focusFiles?.map((group) => group.title)).toEqual([
      "review-first",
      "review-normally",
      "skim",
    ]);
    expect(focusGroup(result, "review-first").map((file) => [file.path, file.area, file.reason])).toEqual([
      ["migrations/002_add_users.sql", "migrations", "migration risk"],
      ["src/auth/session.ts", "authentication", "authentication risk"],
      [".github/workflows/ci.yml", "ci", "CI/workflow risk"],
      ["packages/api/openapi.yaml", "api", "API contract risk"],
    ]);
    expect(focusGroup(result, "review-normally").map((file) => file.path)).toEqual([
      "src/user/z-profile.ts",
      "src/user/a-profile.ts",
    ]);
    expect(focusGroup(result, "skim").map((file) => [file.path, file.reason])).toEqual([
      ["src/generated/client.ts", "generated"],
      ["pnpm-lock.yaml", "lockfile"],
      ["assets/logo.png", "binary file"],
    ]);
    expect(focusGroup(result, "skim")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "src/generated/client.ts", generated: true, lowReviewValue: true }),
        expect.objectContaining({ path: "pnpm-lock.yaml", lowReviewValue: true }),
        expect.objectContaining({ path: "assets/logo.png", binary: true, lowReviewValue: true }),
      ]),
    );

    const groupedPaths = result.focusFiles?.flatMap((group) => group.files.map((file) => file.path)) ?? [];
    expect(new Set(groupedPaths).size).toBe(groupedPaths.length);
    expect(groupedPaths.sort()).toEqual(result.files.map((file) => file.path).sort());
  });

  it("uses config classifications in focus files without overriding higher-priority built-ins", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");
    git(repoPath, ["checkout", "-b", "feature"]);

    write(repoPath, "migrations/001_init.sql", "create table demo(id int);\n");
    write(repoPath, "private/session.logic", "session = true\n");
    write(repoPath, "sdk/client.ts", "export const client = true;\n");
    commit(repoPath, "config focus files");

    const result = await analyzePullRequest({
      repoPath,
      baseRef: "main",
      headRef: "feature",
      focusFiles: true,
      config: {
        schemaVersion: 1,
        paths: {
          generated: ["sdk/**"],
          risk: {
            authentication: ["private/**"],
            configuration: ["migrations/**"],
          },
        },
      },
    });

    expect(focusGroup(result, "review-first").map((file) => [file.path, file.area])).toEqual([
      ["migrations/001_init.sql", "migrations"],
      ["private/session.logic", "authentication"],
    ]);
    expect(focusGroup(result, "skim")).toEqual([
      expect.objectContaining({
        path: "sdk/client.ts",
        reason: "generated",
        generated: true,
        lowReviewValue: true,
      }),
    ]);
  });

  it("returns empty focus groups for an empty diff when requested", async () => {
    const repoPath = createRepository();
    write(repoPath, "README.md", "base\n");
    commit(repoPath, "base");

    const result = await analyzePullRequest({
      repoPath,
      baseRef: "main",
      headRef: "main",
      focusFiles: true,
    });

    expect(result.focusFiles).toEqual([
      { title: "review-first", files: [] },
      { title: "review-normally", files: [] },
      { title: "skim", files: [] },
    ]);
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
    expect(result.risk.score).toBe(5);
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

  it("detects nested workspace manifests for monorepo evidence", async () => {
    const repoPath = createRepository();
    write(repoPath, "packages/api/package.json", JSON.stringify({ name: "api" }));
    write(repoPath, "apps/web/package.json", JSON.stringify({ name: "web" }));
    write(repoPath, "apps/web/pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
    commit(repoPath, "monorepo base");

    const result = await analyzePullRequest({ repoPath, baseRef: "main", headRef: "main" });
    expect(result.evidence.hasPackageManifest).toBe(true);
    expect(result.evidence.manifests).toEqual(["apps/web/package.json", "packages/api/package.json"]);
    expect(result.evidence.packageManager).toBe("pnpm");
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
    expect(result.risk.score).toBe(90);
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

describe("built-in risk classification precedence", () => {
  it("does not classify documentation paths as production risk solely from risky words", () => {
    expect(isDocFile("docs/api/reference.md")).toBe(true);
    expect(isDocFile("docs/migrations/guide.md")).toBe(true);
    expect(isDocFile("docs/configuration.md")).toBe(true);
    expect(getRiskArea("docs/api/reference.md")).toBeUndefined();
    expect(getRiskArea("docs/migrations/guide.md")).toBeUndefined();
    expect(getRiskArea("docs/configuration.md")).toBeUndefined();
  });

  it("does not classify test fixture paths as production risk solely from risky words or JSON", () => {
    expect(isTestFile("tests/fixtures/api-token.json")).toBe(true);
    expect(getRiskArea("tests/fixtures/api-token.json")).toBeUndefined();
  });

  it("still classifies real production risky paths", () => {
    expect(getRiskArea("api/openapi.yaml")).toBe("api");
    expect(getRiskArea("migrations/001_create_users.sql")).toBe("migrations");
    expect(getRiskArea("src/auth/session.ts")).toBe("authentication");
    expect(getRiskArea(".github/workflows/ci.yml")).toBe("ci");
    expect(getRiskArea("package.json")).toBe("dependencies");
    expect(getRiskArea("requirements.txt")).toBe("dependencies");
    expect(isDocFile("requirements.txt")).toBe(false);
    expect(getRiskArea("Gemfile")).toBe("dependencies");
    expect(getRiskArea("Gemfile.lock")).toBe("dependencies");
    expect(getRiskArea("pom.xml")).toBe("dependencies");
    expect(getRiskArea("build.gradle")).toBe("dependencies");
    expect(getRiskArea("build.gradle.kts")).toBe("dependencies");
    expect(getRiskArea("composer.json")).toBe("dependencies");
    expect(getRiskArea(".env.example")).toBe("configuration");
    expect(getRiskArea("config/runtime.json")).toBe("configuration");
  });

  it("does not treat every JSON or YAML file as configuration", () => {
    expect(getRiskArea("src/locales/en.json")).toBeUndefined();
    expect(getRiskArea("src/data/countries.json")).toBeUndefined();
    expect(getRiskArea("eval/expected/api-docs-false-positive.json")).toBeUndefined();
    expect(getRiskArea("app/i18n/translations.yaml")).toBeUndefined();
    expect(getRiskArea(".github/ISSUE_TEMPLATE/bug_report.yml")).toBeUndefined();
    expect(getRiskArea(".github/ISSUE_TEMPLATE/config.yml")).toBeUndefined();
  });

  it("classifies real configuration and infrastructure files", () => {
    expect(getRiskArea("tsconfig.json")).toBe("configuration");
    expect(getRiskArea("tsconfig.build.json")).toBe("configuration");
    expect(getRiskArea("Dockerfile")).toBe("configuration");
    expect(getRiskArea("Dockerfile.production")).toBe("configuration");
    expect(getRiskArea("docker-compose.yml")).toBe("configuration");
    expect(getRiskArea("vite.config.ts")).toBe("configuration");
    expect(getRiskArea("infra/main.tf")).toBe("configuration");
    expect(getRiskArea("terraform/network.tfvars")).toBe("configuration");
    expect(getRiskArea("k8s/deployment.yaml")).toBe("configuration");
  });

  it("requires an auth path segment or filename rather than a risky substring", () => {
    expect(getRiskArea("src/components/LoginButton.tsx")).toBeUndefined();
    expect(getRiskArea("src/components/UserRolesTable.tsx")).toBeUndefined();
    expect(getRiskArea("src/hooks/usePermissionsBanner.ts")).toBeUndefined();
    expect(getRiskArea("src/generated/auth-client.ts")).toBeUndefined();

    expect(getRiskArea("src/pages/login/index.tsx")).toBe("authentication");
    expect(getRiskArea("app/login.ts")).toBe("authentication");
    expect(getRiskArea("modules/identity/session.rb")).toBe("authentication");
    expect(getRiskArea("src/permissions/rbac.go")).toBe("authentication");
  });

  it("limits API risk to contract artifacts instead of internal type directories", () => {
    expect(getRiskArea("src/types/index.ts")).toBeUndefined();
    expect(getRiskArea("src/interfaces/user.ts")).toBeUndefined();

    expect(getRiskArea("api/users.ts")).toBe("api");
    expect(getRiskArea("proto/billing.proto")).toBe("api");
    expect(getRiskArea("schema/public.graphql")).toBe("api");
    expect(getRiskArea("openapi.yaml")).toBe("api");
  });

  it("keeps docs, fixtures, and generated files out of review-first when names look risky", () => {
    const groups = buildFocusFileGroups(
      [
        {
          path: "docs/api/reference.md",
          status: "modified",
          additions: 1,
          deletions: 0,
          isBinary: false,
          isGenerated: false,
          isLowValue: false,
        },
        {
          path: "tests/fixtures/api-token.json",
          status: "modified",
          additions: 1,
          deletions: 0,
          isBinary: false,
          isGenerated: false,
          isLowValue: false,
        },
        {
          path: "src/generated/auth/session.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          isBinary: false,
          isGenerated: true,
          isLowValue: true,
        },
        {
          path: "src/api/routes.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          isBinary: false,
          isGenerated: false,
          isLowValue: false,
        },
      ],
      [
        { id: "authentication", label: "Authentication and security", files: ["src/generated/auth/session.ts"] },
        { id: "api", label: "API and public contracts", files: ["src/api/routes.ts"] },
      ],
    );

    expect(groups.find((group) => group.title === "review-first")?.files.map((file) => file.path)).toEqual([
      "src/api/routes.ts",
    ]);
    expect(groups.find((group) => group.title === "review-normally")?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["docs/api/reference.md", "tests/fixtures/api-token.json"]),
    );
    expect(groups.find((group) => group.title === "skim")?.files).toEqual([
      expect.objectContaining({
        path: "src/generated/auth/session.ts",
        reason: "generated",
        generated: true,
        lowReviewValue: true,
      }),
    ]);
  });

  it("sorts review-normally by reviewable lines without quadratic path lookups", () => {
    const files = Array.from({ length: 40 }, (_, index) => ({
      path: `src/lib/module-${String(index).padStart(2, "0")}.ts`,
      status: "modified" as const,
      additions: index,
      deletions: 0,
      isBinary: false,
      isGenerated: false,
      isLowValue: false,
    }));

    const groups = buildFocusFileGroups(files, []);
    const normally = groups.find((group) => group.title === "review-normally")?.files.map((file) => file.path);
    expect(normally?.[0]).toBe("src/lib/module-39.ts");
    expect(normally?.[1]).toBe("src/lib/module-38.ts");
    expect(normally?.at(-1)).toBe("src/lib/module-00.ts");
  });
});

describe("risk scoring boundaries", () => {
  it("uses low 0-19, medium 20-49, and high 50-100", () => {
    expect(calculateRisk(0, 0, areas("api"), areaLines({ api: 200 }))).toMatchObject({
      score: 15,
      level: "low",
    });
    expect(calculateRisk(0, 0, areas("ci"), areaLines({ ci: 200 }))).toMatchObject({
      score: 20,
      level: "medium",
    });
    expect(calculateRisk(0, 0, areas("migrations", "ci"), areaLines({ ci: 200 }))).toMatchObject({
      score: 50,
      level: "high",
    });
    expect(
      calculateRisk(
        30,
        800,
        areas("migrations", "authentication", "ci", "api", "dependencies", "configuration"),
        areaLines({ ci: 200, api: 200, dependencies: 200, configuration: 200 }),
      ),
    ).toMatchObject({ score: 100, level: "high" });
  });

  it("scores migrations, authentication, and CI on presence, not on size", () => {
    expect(calculateRisk(0, 0, areas("migrations"), areaLines({ migrations: 1 }))).toMatchObject({
      score: 30,
    });
    expect(calculateRisk(0, 0, areas("migrations"), areaLines({ migrations: 500 }))).toMatchObject({
      score: 30,
    });
    expect(
      calculateRisk(0, 0, areas("authentication"), areaLines({ authentication: 1 })),
    ).toMatchObject({ score: 25 });
    expect(calculateRisk(0, 0, areas("ci"), areaLines({ ci: 1 }))).toMatchObject({ score: 20 });
    expect(calculateRisk(0, 0, areas("ci"), areaLines({ ci: 500 }))).toMatchObject({ score: 20 });
  });

  it("scales API, dependency, and configuration points with how much changed", () => {
    expect(calculateRisk(0, 0, areas("dependencies"), areaLines({ dependencies: 0 }))).toMatchObject(
      { score: 5 },
    );
    expect(
      calculateRisk(0, 0, areas("dependencies"), areaLines({ dependencies: 30 })),
    ).toMatchObject({ score: 10 });
    expect(
      calculateRisk(0, 0, areas("dependencies"), areaLines({ dependencies: 200 })),
    ).toMatchObject({ score: 15 });
  });

  it("uses the area file count as well as its line count to pick a band", () => {
    expect(calculateRisk(0, 0, areaWithFiles("configuration", 1), areaLines({}))).toMatchObject({
      score: 5,
    });
    expect(calculateRisk(0, 0, areaWithFiles("configuration", 2), areaLines({}))).toMatchObject({
      score: 10,
    });
    expect(calculateRisk(0, 0, areaWithFiles("configuration", 4), areaLines({}))).toMatchObject({
      score: 15,
    });
  });

  it("reports the change volume behind a scaled area but not a presence area", () => {
    const scaled = calculateRisk(0, 0, areas("dependencies"), areaLines({ dependencies: 2 }));
    expect(scaled.reasons[0]?.description).toBe("Touched dependencies in 1 file, 2 reviewable lines");

    const presence = calculateRisk(0, 0, areas("migrations"), areaLines({ migrations: 2 }));
    expect(presence.reasons[0]?.description).toBe("Touched database migrations");
  });

  it("applies exactly one size band", () => {
    expect(calculateRisk(9, 199, [])).toMatchObject({ score: 0, level: "low" });
    expect(calculateRisk(10, 0, [])).toMatchObject({ score: 10, level: "low" });
    expect(calculateRisk(0, 200, [])).toMatchObject({ score: 10, level: "low" });
    expect(calculateRisk(30, 0, [])).toMatchObject({ score: 20, level: "medium" });
    expect(calculateRisk(0, 800, [])).toMatchObject({ score: 20, level: "medium" });
  });
});

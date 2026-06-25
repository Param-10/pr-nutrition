/* eslint-disable no-undef */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CASE_NAMES = [
  "docs-only",
  "lockfile-only",
  "generated-client",
  "auth-real",
  "auth-false-positive",
  "migration-real",
  "ci-only",
  "rename-only",
  "binary-only",
  "monorepo-package",
];

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "pr-nutrition-eval-"));
const keepTemporaryRepos = process.env.PR_NUTRITION_KEEP_EVAL === "1";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeList(values) {
  return [...values].sort();
}

function formatList(values) {
  return `[${values.join(", ")}]`;
}

function includesText(values, needle) {
  const normalizedNeedle = needle.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalizedNeedle));
}

function assertEqual(failures, label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertListEqual(failures, label, actual, expected) {
  const normalizedActual = normalizeList(actual);
  const normalizedExpected = normalizeList(expected);
  if (JSON.stringify(normalizedActual) === JSON.stringify(normalizedExpected)) return;
  failures.push(`${label}: expected ${formatList(normalizedExpected)}, got ${formatList(normalizedActual)}`);
}

function createRepository(caseName) {
  const repoPath = path.join(temporaryRoot, "repos", caseName);
  mkdirSync(repoPath, { recursive: true });

  function git(args) {
    return run("git", args, { cwd: repoPath });
  }

  function write(relativePath, contents) {
    const targetPath = path.join(repoPath, relativePath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, contents);
  }

  function remove(relativePath) {
    unlinkSync(path.join(repoPath, relativePath));
  }

  function rename(fromPath, toPath) {
    const targetPath = path.join(repoPath, toPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    renameSync(path.join(repoPath, fromPath), targetPath);
  }

  function commit(message) {
    git(["add", "-A"]);
    git(["commit", "-m", message]);
  }

  git(["init", "-b", "main"]);
  git(["config", "user.name", "PR Nutrition Eval"]);
  git(["config", "user.email", "eval@pr-nutrition.local"]);

  return {
    commit,
    git,
    path: repoPath,
    remove,
    rename,
    write,
  };
}

function assertExpected(caseName, result, expected) {
  const failures = [];
  const areaIds = result.areas.map((area) => area.id);
  const lowReviewValuePaths = result.lowReviewValueFiles.map((file) => file.path);

  if (expected.name !== caseName) {
    failures.push(`name: expected ${caseName}, got ${expected.name}`);
  }

  if (expected.expectedRiskLevel !== undefined) {
    assertEqual(failures, "risk.level", result.risk.level, expected.expectedRiskLevel);
  }

  if (expected.minScore !== undefined && result.risk.score < expected.minScore) {
    failures.push(`risk.score: expected >= ${expected.minScore}, got ${result.risk.score}`);
  }

  if (expected.maxScore !== undefined && result.risk.score > expected.maxScore) {
    failures.push(`risk.score: expected <= ${expected.maxScore}, got ${result.risk.score}`);
  }

  if (expected.expectedAreas !== undefined) {
    assertListEqual(failures, "areas", areaIds, expected.expectedAreas);
  }

  for (const area of expected.mustNotIncludeAreas ?? []) {
    if (areaIds.includes(area)) failures.push(`areas: must not include ${area}`);
  }

  if (expected.expectedLowReviewValue !== undefined) {
    assertListEqual(failures, "lowReviewValueFiles", lowReviewValuePaths, expected.expectedLowReviewValue);
  }

  for (const focus of expected.mustIncludeFocus ?? []) {
    if (!includesText(result.reviewFocus, focus)) {
      failures.push(`reviewFocus: expected an item containing ${JSON.stringify(focus)}`);
    }
  }

  for (const focus of expected.mustNotIncludeFocus ?? []) {
    if (includesText(result.reviewFocus, focus)) {
      failures.push(`reviewFocus: must not include an item containing ${JSON.stringify(focus)}`);
    }
  }

  if (expected.expectedWarnings !== undefined) {
    assertListEqual(failures, "warnings", result.warnings, expected.expectedWarnings);
  }

  for (const warning of expected.mustIncludeWarnings ?? []) {
    if (!includesText(result.warnings, warning)) {
      failures.push(`warnings: expected an item containing ${JSON.stringify(warning)}`);
    }
  }

  for (const warning of expected.mustNotIncludeWarnings ?? []) {
    if (includesText(result.warnings, warning)) {
      failures.push(`warnings: must not include an item containing ${JSON.stringify(warning)}`);
    }
  }

  for (const [key, value] of Object.entries(expected.expectedEvidence ?? {})) {
    assertEqual(failures, `evidence.${key}`, result.evidence[key], value);
  }

  for (const [key, value] of Object.entries(expected.expectedSummary ?? {})) {
    assertEqual(failures, `summary.${key}`, result.summary[key], value);
  }

  for (const expectedFile of expected.expectedFiles ?? []) {
    const actualFile = result.files.find((file) => file.path === expectedFile.path);
    if (actualFile === undefined) {
      failures.push(`files: expected ${expectedFile.path} to be present`);
      continue;
    }
    for (const [key, value] of Object.entries(expectedFile)) {
      assertEqual(failures, `files.${expectedFile.path}.${key}`, actualFile[key], value);
    }
  }

  return failures;
}

async function loadCase(caseName) {
  const caseUrl = new URL(`./cases/${caseName}.mjs`, import.meta.url);
  const expectedPath = path.join(workspaceRoot, "eval", "expected", `${caseName}.json`);
  const fixture = await import(caseUrl);
  return {
    build: fixture.default.build,
    expected: readJson(expectedPath),
    name: caseName,
  };
}

try {
  run("pnpm", ["--filter", "@pr-nutrition/core", "build"], {
    cwd: workspaceRoot,
    stdio: "inherit",
  });

  const coreUrl = pathToFileURL(path.join(workspaceRoot, "packages", "core", "dist", "index.js"));
  const { analyzePullRequest } = await import(coreUrl.href);
  const cases = await Promise.all(CASE_NAMES.map(loadCase));
  const results = [];

  for (const evalCase of cases) {
    const repo = createRepository(evalCase.name);
    await evalCase.build(repo);
    const analysis = await analyzePullRequest({
      repoPath: repo.path,
      baseRef: "HEAD~1",
      headRef: "HEAD",
    });
    const failures = assertExpected(evalCase.name, analysis, evalCase.expected);
    results.push({
      analysis,
      failures,
      name: evalCase.name,
    });
  }

  process.stdout.write("\nPR Nutrition eval\n");
  process.stdout.write("Case                    Result  Risk       Files  Reviewable lines\n");
  process.stdout.write("---------------------------------------------------------------\n");
  for (const result of results) {
    const status = result.failures.length === 0 ? "PASS" : "FAIL";
    const risk = `${result.analysis.risk.level}(${result.analysis.risk.score})`;
    process.stdout.write(
      `${result.name.padEnd(23)} ${status.padEnd(7)} ${risk.padEnd(10)} ` +
        `${String(result.analysis.summary.filesChanged).padEnd(6)} ` +
        `${result.analysis.summary.reviewableLines}\n`,
    );
  }

  const failed = results.filter((result) => result.failures.length > 0);
  if (failed.length > 0) {
    process.stdout.write("\nFailures\n");
    for (const result of failed) {
      process.stdout.write(`\n${result.name}\n`);
      for (const failure of result.failures) {
        process.stdout.write(`- ${failure}\n`);
      }
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(`\n${results.length} eval cases passed.\n`);
  }

  if (keepTemporaryRepos) {
    process.stdout.write(`Temporary eval repositories kept at ${temporaryRoot}\n`);
  }
} finally {
  if (!keepTemporaryRepos) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

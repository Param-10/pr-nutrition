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
import { runPackageManager } from "../scripts/package-manager.mjs";

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
  "custom-generated",
  "custom-auth-path",
  "custom-docs-path",
  "author-component-false-positive",
  "design-token-false-positive",
  "api-docs-false-positive",
  "migration-docs-false-positive",
  "config-docs-false-positive",
  "generated-auth-client-false-positive",
  "risky-word-fixtures-false-positive",
  "github-issue-template-false-positive",
  "package-docs-false-positive",
  "release-notes-false-positive",
  "python-requirements",
  "focus-ranking-dogfood",
  "focus-role-order",
  "xcode-tests",
  "xcode-test-name-near-miss",
  "cobol-production",
  "cobol-docs-near-miss",
  "production-size",
  "verification-size-near-miss",
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

const VALID_INTENTS = new Set(["false-positive", "true-positive", "shape"]);

function assertExpected(caseName, result, expected) {
  const failures = [];
  const areaIds = result.areas.map((area) => area.id);
  const lowReviewValuePaths = result.lowReviewValueFiles.map((file) => file.path);

  if (expected.name !== caseName) {
    failures.push(`name: expected ${caseName}, got ${expected.name}`);
  }

  if (!VALID_INTENTS.has(expected.intent)) {
    failures.push(
      `intent: expected one of ${formatList([...VALID_INTENTS])}, got ${JSON.stringify(expected.intent)}`,
    );
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

  for (const expectedExplanation of expected.expectedExplanations ?? []) {
    const match = result.explanations.find(
      (entry) => entry.path === expectedExplanation.path && entry.kind === expectedExplanation.kind,
    );
    if (match === undefined) {
      failures.push(
        `explanations: expected ${expectedExplanation.kind} explanation for ${expectedExplanation.path}`,
      );
      continue;
    }
    for (const [key, value] of Object.entries(expectedExplanation)) {
      if (key === "path" || key === "kind") continue;
      assertEqual(failures, `explanations.${expectedExplanation.path}.${key}`, match[key], value);
    }
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

  for (const [title, expectedPaths] of Object.entries(expected.expectedFocusFiles ?? {})) {
    const actualGroup = result.focusFiles?.find((group) => group.title === title);
    if (actualGroup === undefined) {
      failures.push(`focusFiles.${title}: expected focus group to be present`);
      continue;
    }
    assertListEqual(
      failures,
      `focusFiles.${title}`,
      actualGroup.files.map((file) => file.path),
      expectedPaths,
    );
  }

  for (const [title, expectedPaths] of Object.entries(expected.expectedFocusFileOrder ?? {})) {
    const actualGroup = result.focusFiles?.find((group) => group.title === title);
    if (actualGroup === undefined) {
      failures.push(`focusFiles.${title}: expected focus group to be present`);
      continue;
    }
    assertEqual(
      failures,
      `focusFiles.${title}.order`,
      actualGroup.files.map((file) => file.path),
      expectedPaths,
    );
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
  runPackageManager(["--filter", "@pr-nutrition/core", "build"], {
    cwd: workspaceRoot,
    stdio: "inherit",
  });

  const coreUrl = pathToFileURL(path.join(workspaceRoot, "packages", "core", "dist", "index.js"));
  const { analyzePullRequest, loadAnalysisConfig } = await import(coreUrl.href);
  const cases = await Promise.all(CASE_NAMES.map(loadCase));
  const results = [];

  for (const evalCase of cases) {
    const repo = createRepository(evalCase.name);
    await evalCase.build(repo);
    const config = loadAnalysisConfig({ repoPath: repo.path });
    const analysis = await analyzePullRequest({
      repoPath: repo.path,
      baseRef: "HEAD~1",
      headRef: "HEAD",
      ...(config === undefined ? {} : { config }),
      ...(evalCase.expected.expectedExplanations === undefined ? {} : { explain: true }),
      ...(evalCase.expected.expectedFocusFiles === undefined &&
      evalCase.expected.expectedFocusFileOrder === undefined
        ? {}
        : { focusFiles: true }),
    });
    const failures = assertExpected(evalCase.name, analysis, evalCase.expected);
    results.push({
      analysis,
      failures,
      intent: evalCase.expected.intent,
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

  function rateLabel(passed, total) {
    if (total === 0) return `0/0 (n/a)`;
    const percent = ((passed / total) * 100).toFixed(1).replace(/\.0$/, "");
    return `${passed}/${total} (${percent}%)`;
  }

  const falsePositiveGuardCases = results.filter((result) => result.intent === "false-positive");
  const truePositiveGuardCases = results.filter((result) => result.intent === "true-positive");
  const falsePositiveGuardsPassed = falsePositiveGuardCases.filter(
    (result) => result.failures.length === 0,
  ).length;
  const truePositiveGuardsPassed = truePositiveGuardCases.filter(
    (result) => result.failures.length === 0,
  ).length;

  process.stdout.write("\nGuard-case results\n");
  process.stdout.write(
    `False-positive guards: ${rateLabel(falsePositiveGuardsPassed, falsePositiveGuardCases.length)}\n`,
  );
  process.stdout.write(
    `True-positive guards:  ${rateLabel(truePositiveGuardsPassed, truePositiveGuardCases.length)}\n`,
  );

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
    process.stdout.write(`\nOverall: ${results.length} eval cases passed.\n`);
  }

  if (keepTemporaryRepos) {
    process.stdout.write(`Temporary eval repositories kept at ${temporaryRoot}\n`);
  }
} finally {
  if (!keepTemporaryRepos) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

/* eslint-disable no-undef */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function git(repoPath, args) {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const workspaceRoot = resolve(import.meta.dirname, "..");
const bundlePath = join(workspaceRoot, "packages", "action", "dist", "index.cjs");
if (!existsSync(bundlePath)) throw new Error("Action bundle is missing; run pnpm build first");

const tempPath = mkdtempSync(join(tmpdir(), "pr-nutrition-action-smoke-"));
const repoPath = join(tempPath, "repo");
const outputDirectory = join(tempPath, "output");
const githubOutputPath = join(tempPath, "github-output.txt");
const stepSummaryPath = join(tempPath, "step-summary.md");

try {
  git(tempPath, ["init", "-b", "main", repoPath]);
  git(repoPath, ["config", "user.name", "PR Nutrition Smoke"]);
  git(repoPath, ["config", "user.email", "smoke@example.com"]);
  writeFileSync(join(repoPath, "README.md"), "initial\n", "utf8");
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "initial"]);
  writeFileSync(join(repoPath, "app.ts"), "export const smoke = true;\n", "utf8");
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", "change"]);
  writeFileSync(githubOutputPath, "", "utf8");

  execFileSync(process.execPath, [bundlePath], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      "INPUT_BASE-REF": "HEAD~1",
      "INPUT_HEAD-REF": "HEAD",
      "INPUT_OUTPUT-DIRECTORY": outputDirectory,
      "INPUT_REPO-PATH": repoPath,
      "INPUT_WRITE-STEP-SUMMARY": "true",
      GITHUB_OUTPUT: githubOutputPath,
      GITHUB_STEP_SUMMARY: stepSummaryPath,
      RUNNER_TEMP: tempPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const markdown = readFileSync(join(outputDirectory, "pr-nutrition.md"), "utf8");
  const json = JSON.parse(readFileSync(join(outputDirectory, "pr-nutrition.json"), "utf8"));
  const stepSummary = readFileSync(stepSummaryPath, "utf8");
  const githubOutput = readFileSync(githubOutputPath, "utf8");

  if (!markdown.includes("# PR Nutrition")) throw new Error("Action Markdown output is invalid");
  if (json.schemaVersion !== 1 || json.summary.filesChanged !== 1) {
    throw new Error("Action JSON output is invalid");
  }
  if (!stepSummary.includes("# PR Nutrition")) throw new Error("Action step summary is invalid");
  for (const outputName of [
    "risk-score",
    "risk-level",
    "files-changed",
    "markdown-path",
    "json-path",
  ]) {
    if (!githubOutput.includes(outputName)) throw new Error(`Action output '${outputName}' is missing`);
  }

  process.stdout.write("Action bundle smoke test passed.\n");
} finally {
  rmSync(tempPath, { recursive: true, force: true });
}

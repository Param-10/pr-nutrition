/* eslint-disable no-undef */
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "pr-nutrition-smoke-"));
const packDirectory = path.join(temporaryRoot, "pack");
const consumerDirectory = path.join(temporaryRoot, "consumer");
const repositoryDirectory = path.join(temporaryRoot, "repository");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function git(args) {
  return run("git", args, { cwd: repositoryDirectory });
}

try {
  mkdirSync(packDirectory);
  mkdirSync(consumerDirectory);
  mkdirSync(repositoryDirectory);

  run(
    "pnpm",
    ["--filter", "pr-nutrition", "pack", "--pack-destination", packDirectory],
    { cwd: workspaceRoot },
  );

  const archiveName = readdirSync(packDirectory).find((name) => name.endsWith(".tgz"));
  if (archiveName === undefined) {
    throw new Error("pnpm pack did not create a tarball");
  }
  const archivePath = path.join(packDirectory, archiveName);

  writeFileSync(
    path.join(consumerDirectory, "package.json"),
    JSON.stringify({ name: "pr-nutrition-smoke-consumer", private: true }, null, 2),
  );
  run(
    "npm",
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      archivePath,
    ],
    {
      cwd: consumerDirectory,
      env: { ...process.env, npm_config_cache: path.join(temporaryRoot, "npm-cache") },
    },
  );

  const installedPackagePath = path.join(
    consumerDirectory,
    "node_modules",
    "pr-nutrition",
    "package.json",
  );
  const installedPackage = JSON.parse(readFileSync(installedPackagePath, "utf8"));
  if (installedPackage.dependencies !== undefined) {
    throw new Error("packed CLI unexpectedly declares runtime dependencies");
  }

  git(["init", "-b", "main"]);
  git(["config", "user.name", "PR Nutrition Smoke"]);
  git(["config", "user.email", "smoke@pr-nutrition.local"]);
  writeFileSync(path.join(repositoryDirectory, "source.ts"), "export const value = 1;\n");
  git(["add", "."]);
  git(["commit", "-m", "base"]);
  writeFileSync(path.join(repositoryDirectory, "source.ts"), "export const value = 2;\n");
  git(["add", "."]);
  git(["commit", "-m", "head"]);

  const cliPath = path.join(
    consumerDirectory,
    "node_modules",
    "pr-nutrition",
    "dist",
    "index.cjs",
  );
  const output = run("node", [
    cliPath,
    "--repo",
    repositoryDirectory,
    "--base",
    "HEAD~1",
    "--head",
    "HEAD",
    "--format",
    "json",
  ]);
  const result = JSON.parse(output);
  if (result.schemaVersion !== 1 || result.summary.filesChanged !== 1) {
    throw new Error("packed CLI returned an unexpected analysis result");
  }

  process.stdout.write("Packed CLI offline smoke test passed.\n");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

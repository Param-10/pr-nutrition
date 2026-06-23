/* eslint-disable no-undef */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_NAME = "pr-nutrition";
const EXPECTED_VERSION = "0.1.0";
const EXPECTED_KEYWORDS = [
  "pull-request",
  "code-review",
  "cli",
  "git",
  "developer-tools",
];
const EXPECTED_FILES = [
  "LICENSE",
  "README.md",
  "dist/index.cjs",
  "dist/index.cjs.map",
  "package.json",
];

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliDirectory = path.join(workspaceRoot, "packages", "cli");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "pr-nutrition-release-"));
const packDirectory = path.join(temporaryRoot, "pack");
const consumerDirectory = path.join(temporaryRoot, "consumer");
const repositoryDirectory = path.join(temporaryRoot, "repository");
const npmCacheDirectory = path.join(temporaryRoot, "npm-cache");

function fail(message) {
  throw new Error(`Release check failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

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

function assertPackageMetadata(packageJson) {
  assert(packageJson.name === EXPECTED_NAME, `expected package name ${EXPECTED_NAME}`);
  assert(packageJson.version === EXPECTED_VERSION, `expected package version ${EXPECTED_VERSION}`);
  assert(packageJson.license === "MIT", "expected MIT license metadata");
  assert(packageJson.bin?.[EXPECTED_NAME] === "dist/index.cjs", "expected CLI binary metadata");
  assert(packageJson.engines?.node === ">=22.13 <27", "expected supported Node engine range");
  assert(
    packageJson.repository?.url === "git+https://github.com/Param-10/pr-nutrition.git",
    "expected exact GitHub repository URL",
  );
  assert(
    packageJson.homepage === "https://github.com/Param-10/pr-nutrition#readme",
    "expected GitHub homepage URL",
  );
  assert(
    packageJson.bugs?.url === "https://github.com/Param-10/pr-nutrition/issues",
    "expected GitHub issues URL",
  );
  assert(packageJson.publishConfig?.access === "public", "expected public publish access");
  assert(
    JSON.stringify(packageJson.keywords) === JSON.stringify(EXPECTED_KEYWORDS),
    "expected release keywords",
  );

  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    const dependencies = packageJson[section];
    assert(
      dependencies === undefined || Object.keys(dependencies).length === 0,
      `unexpected runtime dependency section: ${section}`,
    );
    assert(
      !JSON.stringify(dependencies ?? {}).includes("workspace:"),
      `workspace protocol found in runtime dependency section: ${section}`,
    );
  }
}

try {
  mkdirSync(packDirectory);
  mkdirSync(consumerDirectory);
  mkdirSync(repositoryDirectory);

  assert(
    readFileSync(path.join(workspaceRoot, "LICENSE"), "utf8") ===
      readFileSync(path.join(cliDirectory, "LICENSE"), "utf8"),
    "CLI license differs from the repository license",
  );

  run("pnpm", ["build"], { cwd: workspaceRoot });

  const packOutput = run(
    "npm",
    ["pack", "--json", "--pack-destination", packDirectory],
    {
      cwd: cliDirectory,
      env: { ...process.env, npm_config_cache: npmCacheDirectory },
    },
  );
  const [packResult] = JSON.parse(packOutput);
  assert(packResult !== undefined, "npm pack returned no result");
  assert(packResult.name === EXPECTED_NAME, "npm pack returned the wrong package name");
  assert(packResult.version === EXPECTED_VERSION, "npm pack returned the wrong package version");

  const packedFiles = packResult.files.map(({ path: filePath }) => filePath).sort();
  assert(
    JSON.stringify(packedFiles) === JSON.stringify(EXPECTED_FILES),
    `unexpected tarball files: ${packedFiles.join(", ")}`,
  );
  const executable = packResult.files.find(({ path: filePath }) => filePath === "dist/index.cjs");
  assert(executable?.mode === 0o755, "packed CLI binary is not executable");

  const archivePath = path.join(packDirectory, packResult.filename);
  const sha256 = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  writeFileSync(
    path.join(consumerDirectory, "package.json"),
    JSON.stringify({ name: "pr-nutrition-release-consumer", private: true }, null, 2),
  );
  run(
    "npm",
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--omit=dev",
      "--package-lock=false",
      archivePath,
    ],
    {
      cwd: consumerDirectory,
      env: { ...process.env, npm_config_cache: npmCacheDirectory },
    },
  );

  const installedDirectory = path.join(consumerDirectory, "node_modules", EXPECTED_NAME);
  const installedPackage = JSON.parse(
    readFileSync(path.join(installedDirectory, "package.json"), "utf8"),
  );
  assertPackageMetadata(installedPackage);

  const cliPath = path.join(installedDirectory, "dist", "index.cjs");
  assert(run("node", [cliPath, "--version"]).trim() === EXPECTED_VERSION, "version check failed");
  assert(run("node", [cliPath, "--help"]).includes("Usage: pr-nutrition"), "help check failed");

  git(["init", "-b", "main"]);
  git(["config", "user.name", "PR Nutrition Release Check"]);
  git(["config", "user.email", "release-check@pr-nutrition.local"]);
  writeFileSync(path.join(repositoryDirectory, "source.ts"), "export const value = 1;\n");
  git(["add", "."]);
  git(["commit", "-m", "base"]);
  writeFileSync(path.join(repositoryDirectory, "source.ts"), "export const value = 2;\n");
  git(["add", "."]);
  git(["commit", "-m", "head"]);

  const analysis = JSON.parse(
    run("node", [
      cliPath,
      "--repo",
      repositoryDirectory,
      "--base",
      "HEAD~1",
      "--head",
      "HEAD",
      "--format",
      "json",
    ]),
  );
  assert(analysis.schemaVersion === 1, "packed CLI returned the wrong schema version");
  assert(analysis.summary?.filesChanged === 1, "packed CLI returned the wrong file count");

  process.stdout.write(
    `Release package check passed for ${EXPECTED_NAME}@${EXPECTED_VERSION} ` +
      `(${packedFiles.length} files, sha256 ${sha256}).\n`,
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

/* eslint-disable no-undef */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const bundlePath = join(workspaceRoot, "packages", "action", "dist", "index.cjs");

if (!existsSync(bundlePath)) {
  throw new Error("Committed Action bundle is missing");
}

const committedBundle = readFileSync(bundlePath);
execFileSync("pnpm", ["--filter", "@pr-nutrition/core", "build"], {
  cwd: workspaceRoot,
  stdio: "inherit",
});
execFileSync("pnpm", ["--filter", "@pr-nutrition/action", "build"], {
  cwd: workspaceRoot,
  stdio: "inherit",
});
const rebuiltBundle = readFileSync(bundlePath);

if (!committedBundle.equals(rebuiltBundle)) {
  throw new Error("Committed Action bundle differs from a fresh rebuild");
}

const sha256 = createHash("sha256").update(rebuiltBundle).digest("hex");
process.stdout.write(`Action bundle is reproducible (sha256 ${sha256}).\n`);

/* eslint-disable no-undef */
import { execFileSync } from "node:child_process";

export function getPackageManagerCommand() {
  const npmExecPath = process.env.npm_execpath;

  if (!npmExecPath) {
    throw new Error(
      "Package manager path is unavailable. Run this script through corepack pnpm, for example: corepack pnpm <script>.",
    );
  }

  return {
    command: process.execPath,
    argsPrefix: [npmExecPath],
  };
}

export function runPackageManager(args, options = {}) {
  const packageManager = getPackageManagerCommand();

  return execFileSync(packageManager.command, [...packageManager.argsPrefix, ...args], {
    stdio: "inherit",
    ...options,
  });
}

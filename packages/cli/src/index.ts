#!/usr/bin/env node
import { runCli } from "./run.js";

runCli(process.argv).then((code) => {
  process.exitCode = code;
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`pr-nutrition: ${message}`);
  process.exitCode = 2;
});

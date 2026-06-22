import { Command, CommanderError } from "commander";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { analyzePullRequest, renderMarkdown, renderJson } from "@pr-nutrition/core";

export type CliIO = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

export async function runCli(
  argv: string[],
  io: CliIO = {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  }
): Promise<number> {
  const program = new Command();

  program
    .name("pr-nutrition")
    .description("A deterministic pull request review-readiness label generator.")
    .version("0.1.0")
    .option("--repo <path>", "repository path", ".")
    .option("--base <ref>", "base ref", "main")
    .option("--head <ref>", "head ref", "HEAD")
    .option("--format <format>", "output format: markdown or json", "markdown")
    .option("--output <file>", "write output to a file instead of stdout")
    .allowExcessArguments(false)
    .exitOverride()
    .configureOutput({
      writeOut: (str) => io.stdout(str),
      writeErr: (str) => io.stderr(str),
    });

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.code === 'commander.version' || err.code === 'commander.helpDisplayed') {
        return 0;
      }
      return 1;
    }
    throw err;
  }

  const options = program.opts();

  if (options.format !== "markdown" && options.format !== "json") {
    io.stderr(`pr-nutrition: error: option '--format' argument '${options.format}' is invalid. Allowed choices are markdown, json.\nRun \`pr-nutrition --help\` for usage.\n`);
    return 1;
  }

  try {
    const repoPath = path.resolve(options.repo);
    const analysis = await analyzePullRequest({
      repoPath,
      baseRef: options.base,
      headRef: options.head,
    });

    const output =
      options.format === "json"
        ? renderJson(analysis)
        : renderMarkdown(analysis);

    if (options.output) {
      try {
        writeFileSync(options.output, output, "utf8");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        io.stderr(`pr-nutrition: output file write failure - ${msg}\n`);
        return 2;
      }
    } else {
      io.stdout(output);
    }
    
    return 0;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    io.stderr(`pr-nutrition: ${msg}\n`);
    return 2;
  }
}

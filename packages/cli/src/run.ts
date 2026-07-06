import { Command, CommanderError } from "commander";
import { writeFileSync } from "node:fs";
import { analyzePullRequest, loadAnalysisConfig, renderMarkdown, renderJson } from "@pr-nutrition/core";
import type { AnalysisConfig } from "@pr-nutrition/core";

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
  const normalizedArgv = argv[2] === "--" ? [argv[0], argv[1], ...argv.slice(3)] : argv;
  const program = new Command();

  program
    .name("pr-nutrition")
    .description("A deterministic pull request review-readiness label generator.")
    .version("0.1.0")
    .option("--repo <path>", "repository path", ".")
    .option("--base <ref>", "base ref", "main")
    .option("--head <ref>", "head ref", "HEAD")
    .option("--format <format>", "output format: markdown or json", "markdown")
    .option("--json", "write JSON output (alias for --format json)")
    .option("--output <file>", "write output to a file instead of stdout")
    .option("--config <path>", "config file path inside the repository (default: .pr-nutrition.json)")
    .option("--no-config", "disable config file loading")
    .allowExcessArguments(false)
    .exitOverride()
    .configureOutput({
      writeOut: (str) => io.stdout(str),
      writeErr: (str) => io.stderr(str),
    })
    .addHelpText("after", `

Examples:
  $ pr-nutrition
  $ pr-nutrition --json
  $ pr-nutrition --output pr-nutrition.md
  $ pr-nutrition --base origin/main --head HEAD
  $ pr-nutrition --config .pr-nutrition.json
  $ pr-nutrition --no-config
`);

  const hasConfigOption = normalizedArgv.some(
    (argument) => argument === "--config" || argument.startsWith("--config="),
  );
  const hasNoConfigOption = normalizedArgv.includes("--no-config");
  if (hasConfigOption && hasNoConfigOption) {
    io.stderr("pr-nutrition: error: --config cannot be combined with --no-config.\nRun `pr-nutrition --help` for usage.\n");
    return 1;
  }

  try {
    await program.parseAsync(normalizedArgv);
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

  const formatWasProvided = program.getOptionValueSource("format") !== "default";
  if (options.json && formatWasProvided && options.format !== "json") {
    io.stderr("pr-nutrition: error: --json cannot be combined with --format markdown.\nRun `pr-nutrition --help` for usage.\n");
    return 1;
  }

  const format = options.json ? "json" : options.format;

  let config: AnalysisConfig | undefined;
  try {
    config = loadAnalysisConfig({
      repoPath: options.repo,
      configFile: typeof options.config === "string" ? options.config : undefined,
      useConfig: options.config !== false,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    io.stderr(`pr-nutrition: ${msg}\n`);
    return 2;
  }

  try {
    const analysis = await analyzePullRequest({
      repoPath: options.repo,
      baseRef: options.base,
      headRef: options.head,
      ...(config === undefined ? {} : { config }),
    });

    const output =
      format === "json"
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

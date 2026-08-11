import { Command, CommanderError } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzePullRequest,
  loadAnalysisConfig,
  renderDoctorJson,
  renderDoctorText,
  renderMarkdown,
  renderJson,
  runDoctor,
} from "@pr-nutrition/core";
import type { AnalysisConfig } from "@pr-nutrition/core";

export type CliIO = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
};

type RiskLevel = "low" | "medium" | "high";

const RISK_LEVEL_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const FAIL_ON_CHOICES = ["low", "medium", "high"] as const;

function readCliVersion(): string {
  // From src/ during tests and from dist/ after the CJS bundle, package.json is one level up.
  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    throw new Error("Unable to read pr-nutrition version from package.json");
  }
  return packageJson.version;
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "low" || value === "medium" || value === "high";
}

function meetsFailOnThreshold(actual: RiskLevel, threshold: RiskLevel): boolean {
  return RISK_LEVEL_RANK[actual] >= RISK_LEVEL_RANK[threshold];
}

type DoctorCliOptions = {
  repo: string;
  base: string;
  head: string;
  json?: boolean;
  config?: string | false;
};

type AnalyzeCliOptions = DoctorCliOptions & {
  format: string;
  output?: string;
  explain?: boolean;
  focusFiles?: boolean;
  failOn?: string;
};

function runDoctorCli(options: DoctorCliOptions, io: CliIO): number {
  const result = runDoctor({
    repoPath: options.repo,
    baseRef: options.base,
    headRef: options.head,
    ...(typeof options.config === "string" ? { configFile: options.config } : {}),
    useConfig: options.config !== false,
  });

  io.stdout(options.json === true ? renderDoctorJson(result) : renderDoctorText(result));
  return result.status === "error" ? 2 : 0;
}

async function runAnalyzeCli(
  options: AnalyzeCliOptions,
  command: Command,
  io: CliIO,
  defaultFocusFiles: boolean,
): Promise<number> {
  if (options.format !== "markdown" && options.format !== "json") {
    io.stderr(
      `pr-nutrition: error: option '--format' argument '${options.format}' is invalid. Allowed choices are markdown, json.\nRun \`pr-nutrition --help\` for usage.\n`,
    );
    return 1;
  }

  const formatWasProvided = command.getOptionValueSource("format") !== "default";
  if (options.json && formatWasProvided && options.format !== "json") {
    io.stderr(
      "pr-nutrition: error: --json cannot be combined with --format markdown.\nRun `pr-nutrition --help` for usage.\n",
    );
    return 1;
  }

  if (options.failOn !== undefined && !isRiskLevel(options.failOn)) {
    io.stderr(
      `pr-nutrition: error: option '--fail-on' argument '${options.failOn}' is invalid. Allowed choices are ${FAIL_ON_CHOICES.join(", ")}.\nRun \`pr-nutrition --help\` for usage.\n`,
    );
    return 1;
  }

  const format = options.json ? "json" : options.format;
  // check enables focus files by default; the main command only does when --focus-files is set.
  const includeFocusFiles = defaultFocusFiles || options.focusFiles === true;

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
      ...(options.explain === true ? { explain: true } : {}),
      ...(includeFocusFiles ? { focusFiles: true } : {}),
    });

    const renderOptions = {
      explain: options.explain === true,
      focusFiles: includeFocusFiles,
    };
    const output =
      format === "json" ? renderJson(analysis, renderOptions) : renderMarkdown(analysis, renderOptions);

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

    if (isRiskLevel(options.failOn) && meetsFailOnThreshold(analysis.risk.level, options.failOn)) {
      io.stderr(
        `pr-nutrition: risk level ${analysis.risk.level} meets --fail-on ${options.failOn}.\n`,
      );
      return 3;
    }

    return 0;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    io.stderr(`pr-nutrition: ${msg}\n`);
    return 2;
  }
}

function configureCommand(command: Command, io: CliIO): Command {
  return command
    .allowExcessArguments(false)
    .exitOverride()
    .configureOutput({
      writeOut: (str) => io.stdout(str),
      writeErr: (str) => io.stderr(str),
    });
}

function addRepositoryOptions(command: Command): Command {
  return command
    .option("--repo <path>", "repository path", ".")
    .option("--base <ref>", "base ref", "main")
    .option("--head <ref>", "head ref", "HEAD")
    .option("--config <path>", "config file path inside the repository (default: .pr-nutrition.json)")
    .option("--no-config", "disable config file loading");
}

function addAnalyzeOptions(command: Command): Command {
  return addRepositoryOptions(command)
    .option("--format <format>", "output format: markdown or json", "markdown")
    .option("--json", "write JSON output (alias for --format json)")
    .option("--output <file>", "write output to a file instead of stdout")
    .option("--explain", "include a deterministic explanation of classifications")
    .option("--focus-files", "include deterministic file review priority groups")
    .option("--fail-on <level>", "exit 3 when risk level is at least low, medium, or high");
}

export async function runCli(
  argv: string[],
  io: CliIO = {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  },
): Promise<number> {
  const normalizedArgv = argv[2] === "--" ? [argv[0], argv[1], ...argv.slice(3)] : argv;

  const hasConfigOption = normalizedArgv.some(
    (argument) => argument === "--config" || argument.startsWith("--config="),
  );
  const hasNoConfigOption = normalizedArgv.includes("--no-config");
  if (hasConfigOption && hasNoConfigOption) {
    io.stderr(
      "pr-nutrition: error: --config cannot be combined with --no-config.\nRun `pr-nutrition --help` for usage.\n",
    );
    return 1;
  }

  let resultCode = 0;
  const program = addAnalyzeOptions(configureCommand(new Command(), io))
    .name("pr-nutrition")
    .description("A deterministic pull request review-readiness label generator.")
    .version(readCliVersion())
    .enablePositionalOptions()
    .helpCommand(true)
    .addHelpText("after", `

Examples:
  $ pr-nutrition
  $ pr-nutrition --json
  $ pr-nutrition --output pr-nutrition.md
  $ pr-nutrition --base origin/main --head HEAD
  $ pr-nutrition --config .pr-nutrition.json
  $ pr-nutrition --no-config
  $ pr-nutrition --explain
  $ pr-nutrition --json --explain
  $ pr-nutrition --focus-files
  $ pr-nutrition --fail-on medium
  $ pr-nutrition check
  $ pr-nutrition check --fail-on high
  $ pr-nutrition doctor
`)
    .action(async function (this: Command) {
      resultCode = await runAnalyzeCli(this.opts<AnalyzeCliOptions>(), this, io, false);
    });

  addAnalyzeOptions(configureCommand(program.command("check"), io))
    .description(
      "Analyze the current branch before opening or pushing a PR. Enables focus-file groups by default and never blocks unless --fail-on is set.",
    )
    .addHelpText("after", `

Examples:
  $ pr-nutrition check
  $ pr-nutrition check --base main
  $ pr-nutrition check --fail-on high
  $ pr-nutrition check --json --output pr-nutrition.json
`)
    .action(async function (this: Command) {
      resultCode = await runAnalyzeCli(this.opts<AnalyzeCliOptions>(), this, io, true);
    });

  addRepositoryOptions(configureCommand(program.command("doctor"), io))
    .description("Diagnose whether PR Nutrition can run in this repository.")
    .option("--json", "write JSON output")
    .action(function (this: Command) {
      resultCode = runDoctorCli(this.opts<DoctorCliOptions>(), io);
    });

  try {
    await program.parseAsync(normalizedArgv);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (
        err.code === "commander.version" ||
        err.code === "commander.help" ||
        err.code === "commander.helpDisplayed"
      ) {
        return 0;
      }
      return 1;
    }
    throw err;
  }

  return resultCode;
}

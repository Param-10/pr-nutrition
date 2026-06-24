import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyzePullRequest, renderJson, renderMarkdown } from "@pr-nutrition/core";
import type { AnalysisResult } from "@pr-nutrition/core";

const DEFAULT_OUTPUT_DIRECTORY = "$RUNNER_TEMP/pr-nutrition";

export interface ActionIO {
  getInput: (name: string) => string;
  setOutput: (name: string, value: string | number) => void;
  warning: (message: string) => void;
}

export interface ActionEnvironment {
  GITHUB_EVENT_NAME?: string;
  GITHUB_EVENT_PATH?: string;
  GITHUB_STEP_SUMMARY?: string;
  RUNNER_TEMP?: string;
}

export interface RefContext {
  eventName?: string | undefined;
  eventPath?: string | undefined;
}

export interface ResolvedRefs {
  baseRef: string;
  headRef: string;
}

export interface ActionResult {
  analysis: AnalysisResult;
  jsonPath: string;
  markdownPath: string;
}

function parseBoolean(value: string, name: string, defaultValue: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return defaultValue;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Input '${name}' must be 'true' or 'false'`);
}

function readPullRequestRefs(context: RefContext): ResolvedRefs {
  if (context.eventName !== "pull_request") {
    throw new Error(
      "This event is not a pull request. Provide both 'base-ref' and 'head-ref' for non-PR events.",
    );
  }
  if (context.eventPath === undefined || context.eventPath.length === 0) {
    throw new Error("GITHUB_EVENT_PATH is unavailable for the pull request event");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(context.eventPath, "utf8"));
  } catch (error) {
    throw new Error("Could not read the pull request event payload", { cause: error });
  }

  const pullRequest =
    typeof payload === "object" && payload !== null && "pull_request" in payload
      ? payload.pull_request
      : undefined;
  const base =
    typeof pullRequest === "object" && pullRequest !== null && "base" in pullRequest
      ? pullRequest.base
      : undefined;
  const head =
    typeof pullRequest === "object" && pullRequest !== null && "head" in pullRequest
      ? pullRequest.head
      : undefined;
  const baseRef =
    typeof base === "object" && base !== null && "sha" in base && typeof base.sha === "string"
      ? base.sha
      : undefined;
  const headRef =
    typeof head === "object" && head !== null && "sha" in head && typeof head.sha === "string"
      ? head.sha
      : undefined;

  if (baseRef === undefined || headRef === undefined || baseRef.length === 0 || headRef.length === 0) {
    throw new Error("Pull request event payload does not contain base and head SHAs");
  }
  return { baseRef, headRef };
}

export function resolveRefs(baseInput: string, headInput: string, context: RefContext): ResolvedRefs {
  const baseRef = baseInput.trim();
  const headRef = headInput.trim();
  if ((baseRef.length === 0) !== (headRef.length === 0)) {
    throw new Error("Inputs 'base-ref' and 'head-ref' must be provided together");
  }
  if (baseRef.length > 0 && headRef.length > 0) {
    return { baseRef, headRef };
  }
  return readPullRequestRefs(context);
}

function resolveOutputDirectory(input: string, runnerTemp: string | undefined): string {
  const outputDirectory = input.trim() || DEFAULT_OUTPUT_DIRECTORY;
  if (outputDirectory === DEFAULT_OUTPUT_DIRECTORY) {
    if (runnerTemp === undefined || runnerTemp.length === 0) {
      throw new Error("RUNNER_TEMP is unavailable; provide an explicit 'output-directory'");
    }
    return join(runnerTemp, "pr-nutrition");
  }
  return resolve(outputDirectory);
}

export function formatActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("Failed to find merge base between")) {
    return `${message}. Ensure actions/checkout uses fetch-depth: 0. PR Nutrition does not fetch Git history.`;
  }
  return message;
}

export async function runAction(
  io: ActionIO,
  environment: ActionEnvironment = process.env,
): Promise<ActionResult> {
  const refs = resolveRefs(io.getInput("base-ref"), io.getInput("head-ref"), {
    eventName: environment.GITHUB_EVENT_NAME,
    eventPath: environment.GITHUB_EVENT_PATH,
  });
  const repoPath = io.getInput("repo-path").trim() || ".";
  const outputDirectory = resolveOutputDirectory(
    io.getInput("output-directory"),
    environment.RUNNER_TEMP,
  );
  const writeStepSummary = parseBoolean(
    io.getInput("write-step-summary"),
    "write-step-summary",
    true,
  );

  const analysis = await analyzePullRequest({
    repoPath,
    baseRef: refs.baseRef,
    headRef: refs.headRef,
  });
  const markdown = renderMarkdown(analysis);
  const json = renderJson(analysis);
  const markdownPath = join(outputDirectory, "pr-nutrition.md");
  const jsonPath = join(outputDirectory, "pr-nutrition.json");

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(markdownPath, markdown, "utf8");
  writeFileSync(jsonPath, json, "utf8");

  if (writeStepSummary) {
    const stepSummaryPath = environment.GITHUB_STEP_SUMMARY;
    if (stepSummaryPath === undefined || stepSummaryPath.length === 0) {
      io.warning("GITHUB_STEP_SUMMARY is unavailable; skipped the step summary");
    } else {
      appendFileSync(stepSummaryPath, markdown, "utf8");
    }
  }

  for (const warning of analysis.warnings) io.warning(warning);

  io.setOutput("risk-score", String(analysis.risk.score));
  io.setOutput("risk-level", analysis.risk.level);
  io.setOutput("files-changed", String(analysis.summary.filesChanged));
  io.setOutput("markdown-path", markdownPath);
  io.setOutput("json-path", jsonPath);

  return { analysis, jsonPath, markdownPath };
}

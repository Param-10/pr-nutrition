/* eslint-disable no-undef */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PROHIBITED_AI_IDENTITIES = [
  "antigravity",
  "claude",
  "codex",
  "copilot",
  "cursor",
  "devin",
  "gemini",
  "windsurf",
];

const REQUIRED_PR_SECTIONS = [
  "what changed",
  "why it changed",
  "how it was tested",
  "pr nutrition output",
];

function normalizeHeading(heading) {
  return heading.trim().toLowerCase().replace(/, if applicable$/, "");
}

export function validateCommitMessage(message) {
  const errors = [];
  for (const line of message.split(/\r?\n/)) {
    if (!/^\s*co-authored-by:/i.test(line)) continue;
    const lowerLine = line.toLowerCase();
    const identity = PROHIBITED_AI_IDENTITIES.find((name) => lowerLine.includes(name));
    if (identity !== undefined) {
      errors.push(`AI-agent co-author trailer is not allowed: ${line.trim()}`);
    }
  }
  return errors;
}

export function validatePullRequestBody(body) {
  if (typeof body !== "string" || body.trim().length === 0) {
    return ["Pull request description is empty."];
  }

  const sections = new Map();
  const matches = [...body.matchAll(/^##\s+(.+?)\s*$/gm)];
  for (const [index, match] of matches.entries()) {
    const heading = normalizeHeading(match[1]);
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = matches[index + 1]?.index ?? body.length;
    sections.set(heading, body.slice(contentStart, contentEnd).trim());
  }

  const errors = [];
  for (const requiredSection of REQUIRED_PR_SECTIONS) {
    const content = sections.get(requiredSection);
    if (content === undefined) {
      errors.push(`Missing required PR section: ${requiredSection}.`);
    } else if (content.length === 0) {
      errors.push(`Required PR section is empty: ${requiredSection}.`);
    }
  }

  const testing = sections.get("how it was tested");
  if (testing !== undefined) {
    const meaningfulTesting = testing
      .split(/\r?\n/)
      .filter((line) => !/^\s*- \[ \]\s*/.test(line))
      .join("\n")
      .trim();
    if (meaningfulTesting.length === 0) {
      errors.push("How it was tested must include a completed check or test evidence.");
    }
  }

  return errors;
}

export function readPullRequestRefs(eventPath) {
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const baseRef = event.pull_request?.base?.sha;
  const headRef = event.pull_request?.head?.sha;
  const isCommitSha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
  return {
    ...(isCommitSha(baseRef) ? { baseRef } : {}),
    ...(isCommitSha(headRef) ? { headRef } : {}),
  };
}

export function readCommitMessages(repoPath, baseRef, headRef) {
  const output = execFileSync("git", ["log", "--format=%x1e%H%x00%B", `${baseRef}..${headRef}`], {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return output
    .split("\x1e")
    .filter((record) => record.trim().length > 0)
    .map((record) => {
      const separator = record.indexOf("\0");
      return {
        sha: record.slice(0, separator).trim(),
        message: record.slice(separator + 1).trim(),
      };
    });
}

export function checkPullRequestPolicy(options) {
  const errors = [];
  for (const commit of readCommitMessages(options.repoPath, options.baseRef, options.headRef)) {
    for (const error of validateCommitMessage(commit.message)) {
      errors.push(`${commit.sha.slice(0, 7)}: ${error}`);
    }
  }

  if (options.eventPath !== undefined) {
    const event = JSON.parse(readFileSync(options.eventPath, "utf8"));
    if (event.pull_request !== undefined) {
      errors.push(...validatePullRequestBody(event.pull_request.body));
    }
  }

  return errors;
}

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const eventRefs = eventPath === undefined ? {} : readPullRequestRefs(eventPath);
  const baseRef = process.argv[2] ?? process.env.PR_NUTRITION_POLICY_BASE ?? eventRefs.baseRef ?? "origin/main";
  const headRef = process.argv[3] ?? process.env.PR_NUTRITION_POLICY_HEAD ?? eventRefs.headRef ?? "HEAD";
  const errors = checkPullRequestPolicy({
    repoPath: process.cwd(),
    baseRef,
    headRef,
    ...(eventPath === undefined ? {} : { eventPath }),
  });

  if (errors.length > 0) {
    process.stderr.write("PR policy check failed:\n");
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write("PR policy check passed.\n");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}

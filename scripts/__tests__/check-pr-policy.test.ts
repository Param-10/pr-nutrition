import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkPullRequestPolicy,
  readPullRequestRefs,
  validateCommitMessage,
  validatePullRequestBody,
} from "../check-pr-policy.mjs";

const repositories: string[] = [];

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createRepository(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "pr-nutrition-policy-"));
  repositories.push(repoPath);
  git(repoPath, ["init", "-b", "main"]);
  git(repoPath, ["config", "user.name", "PR Nutrition Test"]);
  git(repoPath, ["config", "user.email", "test@pr-nutrition.local"]);
  return repoPath;
}

function commit(repoPath: string, message: string): void {
  writeFileSync(join(repoPath, "file.txt"), `${message}\n`);
  git(repoPath, ["add", "file.txt"]);
  git(repoPath, ["commit", "-m", message]);
}

afterEach(() => {
  for (const repoPath of repositories.splice(0)) {
    rmSync(repoPath, { recursive: true, force: true });
  }
});

describe("PR policy", () => {
  it("rejects AI-agent co-author trailers and permits human co-authors", () => {
    expect(validateCommitMessage("feat: example\n\nCo-authored-by: Cursor <cursoragent@cursor.com>")).toEqual([
      "AI-agent co-author trailer is not allowed: Co-authored-by: Cursor <cursoragent@cursor.com>",
    ]);
    expect(validateCommitMessage("feat: example\n\nCo-authored-by: Human Person <human@example.com>")).toEqual([]);
    expect(validateCommitMessage("feat: example\n\n  Co-authored-by: Codex <agent@example.com>")).toHaveLength(1);
  });

  it("requires completed PR template sections", () => {
    const validBody = `## What changed

Added policy checks.

## Why it changed

Keep repository authoring rules enforceable.

## How it was tested

- [x] pnpm test

## PR Nutrition output, if applicable

Medium risk; review CI policy first.
`;
    expect(validatePullRequestBody(validBody)).toEqual([]);
    expect(validatePullRequestBody("## What changed\n\nOnly this section.")).toEqual([
      "Missing required PR section: why it changed.",
      "Missing required PR section: how it was tested.",
      "Missing required PR section: pr nutrition output.",
    ]);
    expect(
      validatePullRequestBody(
        validBody.replace("- [x] pnpm test", "- [ ] pnpm test"),
      ),
    ).toContain("How it was tested must include a completed check or test evidence.");
  });

  it("reads only validated commit SHAs from the pull-request event", () => {
    const repoPath = createRepository();
    const eventPath = join(repoPath, "event.json");
    writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          base: { sha: "a".repeat(40) },
          head: { sha: "b".repeat(40) },
        },
      }),
    );

    expect(readPullRequestRefs(eventPath)).toEqual({
      baseRef: "a".repeat(40),
      headRef: "b".repeat(40),
    });

    writeFileSync(
      eventPath,
      JSON.stringify({ pull_request: { base: { sha: "--help" }, head: { sha: "not-a-sha" } } }),
    );
    expect(readPullRequestRefs(eventPath)).toEqual({});
  });

  it("checks only commits in the requested range", () => {
    const repoPath = createRepository();
    commit(repoPath, "base");
    const baseRef = git(repoPath, ["rev-parse", "HEAD"]).trim();
    commit(repoPath, "fix: trust policy");

    expect(checkPullRequestPolicy({ repoPath, baseRef, headRef: "HEAD" })).toEqual([]);

    commit(repoPath, "fix: prohibited\n\nCo-authored-by: Codex <agent@example.com>");
    expect(checkPullRequestPolicy({ repoPath, baseRef, headRef: "HEAD" }).join("\n")).toContain(
      "AI-agent co-author trailer is not allowed",
    );
  });
});

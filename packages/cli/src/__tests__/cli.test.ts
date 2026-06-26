import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runCli, CliIO } from '../run.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function initGitRepo(repoPath: string): void {
  git(repoPath, ["init", "-b", "main"]);
  git(repoPath, ["config", "user.name", "PR Nutrition Test"]);
  git(repoPath, ["config", "user.email", "test@example.com"]);
}

function commitAll(repoPath: string, message: string): void {
  git(repoPath, ["add", "."]);
  git(repoPath, ["commit", "-m", message]);
}

function createMockIO(): { io: CliIO, getStdout: () => string, getStderr: () => string } {
  let stdoutData = '';
  let stderrData = '';
  return {
    io: {
      stdout: (text: string) => { stdoutData += text; },
      stderr: (text: string) => { stderrData += text; }
    },
    getStdout: () => stdoutData,
    getStderr: () => stderrData
  };
}

describe('pr-nutrition CLI runner', () => {
  it('returns 0 on --help', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--help'], io);
    expect(code).toBe(0);
    expect(getStdout()).toContain('Usage: pr-nutrition');
    expect(getStdout()).toContain('--json');
    expect(getStdout()).toContain('Examples:');
    expect(getStdout()).toContain('pr-nutrition --output pr-nutrition.md');
  });

  it('returns 0 and prints version on --version', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--version'], io);
    expect(code).toBe(0);
    expect(getStdout()).toContain('0.1.0');
  });

  it('returns 1 on invalid format', async () => {
    const { io, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--format', 'xml'], io);
    expect(code).toBe(1);
    expect(getStderr()).toContain('invalid');
  });

  it('returns 1 when --json conflicts with explicit markdown format', async () => {
    const { io, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--json', '--format', 'markdown'], io);
    expect(code).toBe(1);
    expect(getStderr()).toContain('--json cannot be combined with --format markdown');
  });

  it('returns 1 on unknown option', async () => {
    const { io, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--fake'], io);
    expect(code).toBe(1);
    expect(getStderr()).toContain('unknown option');
  });

  it('returns 1 on missing option value', async () => {
    const { io, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--format'], io);
    expect(code).toBe(1);
    expect(getStderr()).toContain('argument missing');
  });

  it('returns 1 on extra positional arg', async () => {
    const { io, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', 'extra-arg'], io);
    expect(code).toBe(1);
    expect(getStderr()).toContain('too many arguments');
  });
});

describe('pr-nutrition CLI integration', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = mkdtempSync(path.join(tmpdir(), 'pr-nutrition-cli-test-'));
    initGitRepo(tmpRepo);
    writeFileSync(path.join(tmpRepo, 'file.txt'), 'content\n');
    commitAll(tmpRepo, 'initial');
    // create a head commit
    writeFileSync(path.join(tmpRepo, 'file.txt'), 'change\n');
    commitAll(tmpRepo, 'change');
  });

  afterEach(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('returns 2 on output file write failure', async () => {
    const { io, getStderr } = createMockIO();
    // Try to write to a non-existent directory without creating it, using valid repo so analyzer passes
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--output', '/does/not/exist/file.md'], io);
    expect(code).toBe(2);
    expect(getStderr()).toContain('output file write failure');
  });

  it('outputs markdown to stdout by default', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD'], io);
    expect(code).toBe(0);
    expect(getStdout()).toContain('# PR Nutrition');
  });

  it('outputs json to stdout when --format json', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--format', 'json'], io);
    expect(code).toBe(0);
    const json = JSON.parse(getStdout());
    expect(json.schemaVersion).toBe(1);
  });

  it('outputs json to stdout when --json', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--json'], io);
    expect(code).toBe(0);
    const json = JSON.parse(getStdout());
    expect(json.schemaVersion).toBe(1);
  });

  it('outputs json when --json and --format json are combined', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--json', '--format', 'json'], io);
    expect(code).toBe(0);
    const json = JSON.parse(getStdout());
    expect(json.schemaVersion).toBe(1);
  });

  it('writes output to file and stdout is empty', async () => {
    const { io, getStdout } = createMockIO();
    const outPath = path.join(tmpRepo, 'out.md');
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--output', outPath], io);
    expect(code).toBe(0);
    expect(getStdout()).toBe('');
    const content = readFileSync(outPath, 'utf8');
    expect(content).toContain('# PR Nutrition');
  });

  it('writes json output to file and stdout is empty', async () => {
    const { io, getStdout } = createMockIO();
    const outPath = path.join(tmpRepo, 'out.json');
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--json', '--output', outPath], io);
    expect(code).toBe(0);
    expect(getStdout()).toBe('');
    const json = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(json.schemaVersion).toBe(1);
  });

  it('returns 2 if repo path is invalid', async () => {
    const { io, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', '/invalid/repo/path'], io);
    expect(code).toBe(2);
    expect(getStderr()).toContain('pr-nutrition:');
  });

  it('returns 2 if missing base ref (e.g. invalid ref)', async () => {
    const { io, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'does-not-exist', '--head', 'HEAD'], io);
    expect(code).toBe(2);
    expect(getStderr()).toContain('pr-nutrition:');
  });
});

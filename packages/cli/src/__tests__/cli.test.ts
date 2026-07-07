import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runCli, CliIO } from '../run.js';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
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
    expect(getStdout()).toContain('--focus-files');
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
    expect(getStdout()).not.toContain('## Focus files');
  });

  it('outputs focus files in markdown with --focus-files', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--focus-files'], io);
    expect(code).toBe(0);
    expect(getStdout()).toContain('## Focus files');
    expect(getStdout()).toContain('### Review normally');
    expect(getStdout()).toContain('`file.txt` — reviewable source change');
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
    expect(json.focusFiles).toBeUndefined();
  });

  it('outputs focus files in json with --json --focus-files and keeps stderr clean', async () => {
    const { io, getStdout, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--json', '--focus-files'], io);
    expect(code).toBe(0);
    const json = JSON.parse(getStdout());
    expect(json.focusFiles).toEqual([
      {
        title: 'review-first',
        files: [],
      },
      {
        title: 'review-normally',
        files: [
          {
            path: 'file.txt',
            reason: 'reviewable source change',
            status: 'modified',
          },
        ],
      },
      {
        title: 'skim',
        files: [],
      },
    ]);
    expect(getStderr()).toBe('');
  });

  it('outputs focus files in json with --format json --focus-files', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--format', 'json', '--focus-files'], io);
    expect(code).toBe(0);
    expect(JSON.parse(getStdout()).focusFiles).toHaveLength(3);
  });

  it('outputs the same json shape for --json and --format json', async () => {
    const formatJson = createMockIO();
    const shortcutJson = createMockIO();

    await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--format', 'json'], formatJson.io);
    await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--json'], shortcutJson.io);

    expect(JSON.parse(shortcutJson.getStdout())).toEqual(JSON.parse(formatJson.getStdout()));
  });

  it('accepts a package-script separator before options', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--json'], io);
    expect(code).toBe(0);
    expect(JSON.parse(getStdout()).schemaVersion).toBe(1);
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

  it('keeps focus-files errors on stderr', async () => {
    const { io, getStdout, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'does-not-exist', '--head', 'HEAD', '--focus-files'], io);
    expect(code).toBe(2);
    expect(getStdout()).toBe('');
    expect(getStderr()).toContain('pr-nutrition:');
  });
});

describe('pr-nutrition CLI configuration', () => {
  let tmpRepo: string;

  const generatedConfig = JSON.stringify({
    schemaVersion: 1,
    paths: { generated: ['sdk/**'] },
  });

  beforeEach(() => {
    tmpRepo = mkdtempSync(path.join(tmpdir(), 'pr-nutrition-cli-config-'));
    initGitRepo(tmpRepo);
    writeFileSync(path.join(tmpRepo, 'file.txt'), 'content\n');
    commitAll(tmpRepo, 'initial');
    mkdirSync(path.join(tmpRepo, 'sdk'));
    writeFileSync(path.join(tmpRepo, 'sdk', 'client.ts'), 'export const value = 1;\n');
    commitAll(tmpRepo, 'change');
  });

  afterEach(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  async function analyze(extraArgs: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    const { io, getStdout, getStderr } = createMockIO();
    const code = await runCli(
      ['node', 'pr-nutrition', '--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD', '--json', ...extraArgs],
      io,
    );
    return { code, stdout: getStdout(), stderr: getStderr() };
  }

  it('applies an auto-discovered .pr-nutrition.json', async () => {
    writeFileSync(path.join(tmpRepo, '.pr-nutrition.json'), generatedConfig);
    const { code, stdout } = await analyze([]);
    expect(code).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.summary.reviewableFiles).toBe(0);
    expect(json.lowReviewValueFiles.map((file: { path: string }) => file.path)).toEqual(['sdk/client.ts']);
  });

  it('applies an explicit --config file over discovery', async () => {
    writeFileSync(path.join(tmpRepo, '.pr-nutrition.json'), JSON.stringify({ schemaVersion: 1 }));
    writeFileSync(path.join(tmpRepo, 'custom-config.json'), generatedConfig);
    const { code, stdout } = await analyze(['--config', 'custom-config.json']);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).summary.reviewableFiles).toBe(0);
  });

  it('ignores a discovered config with --no-config', async () => {
    writeFileSync(path.join(tmpRepo, '.pr-nutrition.json'), generatedConfig);
    const { code, stdout } = await analyze(['--no-config']);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).summary.reviewableFiles).toBe(1);
  });

  it('returns 2 on an invalid discovered config', async () => {
    writeFileSync(path.join(tmpRepo, '.pr-nutrition.json'), '{not json');
    const { code, stderr } = await analyze([]);
    expect(code).toBe(2);
    expect(stderr).toContain('Invalid PR Nutrition config');
  });

  it('returns 2 on an invalid explicit config', async () => {
    writeFileSync(path.join(tmpRepo, 'bad.json'), JSON.stringify({ schemaVersion: 99 }));
    const { code, stderr } = await analyze(['--config', 'bad.json']);
    expect(code).toBe(2);
    expect(stderr).toContain("unsupported 'schemaVersion'");
  });

  it('returns 1 when --config and --no-config are combined', async () => {
    const { code, stderr } = await analyze(['--config', 'custom.json', '--no-config']);
    expect(code).toBe(1);
    expect(stderr).toContain('--config cannot be combined with --no-config');
  });
});

describe('pr-nutrition CLI explain', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = mkdtempSync(path.join(tmpdir(), 'pr-nutrition-cli-explain-'));
    initGitRepo(tmpRepo);
    writeFileSync(path.join(tmpRepo, 'file.txt'), 'content\n');
    commitAll(tmpRepo, 'initial');
    mkdirSync(path.join(tmpRepo, 'src', 'auth'), { recursive: true });
    writeFileSync(path.join(tmpRepo, 'src', 'auth', 'login.ts'), 'export const login = 1;\n');
    commitAll(tmpRepo, 'change');
  });

  afterEach(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  function baseArgs(): string[] {
    return ['--repo', tmpRepo, '--base', 'HEAD~1', '--head', 'HEAD'];
  }

  it('omits the Explanation section from Markdown by default', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', ...baseArgs()], io);
    expect(code).toBe(0);
    expect(getStdout()).not.toContain('## Explanation');
  });

  it('includes an Explanation section with --explain', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', ...baseArgs(), '--explain'], io);
    expect(code).toBe(0);
    expect(getStdout()).toContain('## Explanation');
    expect(getStdout()).toContain('builtin.path.authentication');
  });

  it('supports --explain with --focus-files in Markdown', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', ...baseArgs(), '--explain', '--focus-files'], io);
    expect(code).toBe(0);
    expect(getStdout()).toContain('## Focus files');
    expect(getStdout()).toContain('## Explanation');
    expect(getStdout()).toContain('`src/auth/login.ts` — authentication risk');
  });

  it('omits explanations from JSON by default', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', ...baseArgs(), '--json'], io);
    expect(code).toBe(0);
    const json = JSON.parse(getStdout());
    expect(json.explanations).toBeUndefined();
  });

  it('includes explanations with --json --explain and stays clean JSON', async () => {
    const { io, getStdout, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', ...baseArgs(), '--json', '--explain'], io);
    expect(code).toBe(0);
    const json = JSON.parse(getStdout());
    expect(Array.isArray(json.explanations)).toBe(true);
    expect(json.explanations.some((entry: { ruleId: string }) => entry.ruleId === 'builtin.path.authentication')).toBe(true);
    expect(getStderr()).toBe('');
  });

  it('supports --json --explain --focus-files and stays clean JSON', async () => {
    const { io, getStdout, getStderr } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', ...baseArgs(), '--json', '--explain', '--focus-files'], io);
    expect(code).toBe(0);
    const json = JSON.parse(getStdout());
    expect(Array.isArray(json.focusFiles)).toBe(true);
    expect(Array.isArray(json.explanations)).toBe(true);
    expect(json.focusFiles[0].files[0]).toMatchObject({
      path: 'src/auth/login.ts',
      area: 'authentication',
    });
    expect(getStderr()).toBe('');
  });

  it('supports --format json --explain', async () => {
    const { io, getStdout } = createMockIO();
    const code = await runCli(['node', 'pr-nutrition', ...baseArgs(), '--format', 'json', '--explain'], io);
    expect(code).toBe(0);
    expect(Array.isArray(JSON.parse(getStdout()).explanations)).toBe(true);
  });
});

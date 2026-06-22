/* eslint-disable no-undef */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const cliPath = path.join(workspaceRoot, 'packages', 'cli', 'dist', 'index.cjs');
const examplesDir = path.join(workspaceRoot, 'examples', 'demo-pr');
const deterministicGitEnv = {
  ...process.env,
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z'
};

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...options });
}

function git(repoPath, args) {
  return run('git', args, { cwd: repoPath, env: deterministicGitEnv });
}

console.log('Building CLI...');
run('pnpm', ['build'], { cwd: workspaceRoot });

console.log('Creating temp directory...');
const tmpRepo = mkdtempSync(path.join(tmpdir(), 'pr-nutrition-examples-'));

try {
  console.log(`Initializing git repo in ${tmpRepo}...`);
  git(tmpRepo, ['init', '-b', 'main']);
  git(tmpRepo, ['config', 'user.name', 'PR Nutrition Example']);
  git(tmpRepo, ['config', 'user.email', 'example@pr-nutrition.local']);

  // Base files
  mkdirSync(path.join(tmpRepo, 'src', 'auth'), { recursive: true });
  mkdirSync(path.join(tmpRepo, '.github', 'workflows'), { recursive: true });

  writeFileSync(path.join(tmpRepo, 'src', 'auth', 'session.ts'), '// base session\n');
  writeFileSync(path.join(tmpRepo, 'openapi.yaml'), 'openapi: 3.0.0\n');
  writeFileSync(path.join(tmpRepo, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  writeFileSync(path.join(tmpRepo, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
  writeFileSync(path.join(tmpRepo, 'src', 'auth', 'session.test.ts'), '// test\n');
  writeFileSync(path.join(tmpRepo, 'package.json'), '{"scripts":{"test":"vitest","typecheck":"tsc"}}');

  git(tmpRepo, ['add', '.']);
  git(tmpRepo, ['commit', '-m', 'Initial commit']);

  // Head changes
  writeFileSync(path.join(tmpRepo, 'src', 'auth', 'session.ts'), '// updated session\n// logic added\n');
  writeFileSync(path.join(tmpRepo, 'openapi.yaml'), 'openapi: 3.0.0\ninfo:\n  title: Updated API\n');
  writeFileSync(path.join(tmpRepo, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\ndependencies:\n  new-dep: 1.0.0\n');
  writeFileSync(path.join(tmpRepo, '.github', 'workflows', 'ci.yml'), 'name: CI\non: push\n');

  git(tmpRepo, ['add', '.']);
  git(tmpRepo, ['commit', '-m', 'Add features']);

  // Run CLI to generate outputs
  mkdirSync(examplesDir, { recursive: true });
  
  console.log('Generating Markdown example...');
  run('node', [
    cliPath,
    '--repo', '.',
    '--base', 'HEAD~1',
    '--head', 'HEAD',
    '--format', 'markdown',
    '--output', path.join(examplesDir, 'pr-nutrition.md')
  ], { cwd: tmpRepo });

  console.log('Generating JSON example...');
  run('node', [
    cliPath,
    '--repo', '.',
    '--base', 'HEAD~1',
    '--head', 'HEAD',
    '--format', 'json',
    '--output', path.join(examplesDir, 'pr-nutrition.json')
  ], { cwd: tmpRepo });

  console.log('Examples generated successfully!');

} finally {
  console.log(`Cleaning up temp directory ${tmpRepo}...`);
  rmSync(tmpRepo, { recursive: true, force: true });
}

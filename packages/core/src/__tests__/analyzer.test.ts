import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analyzePullRequest } from '../analyzer.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Core Analyzer', () => {
  let tmpRepo: string;

  function run(args: string[]) {
    execFileSync('git', args, { cwd: tmpRepo, encoding: 'utf8' });
  }

  beforeAll(() => {
    tmpRepo = mkdtempSync(join(tmpdir(), 'pr-nutrition-core-'));
    
    // Init bare repo
    run(['init', '-b', 'main']);
    run(['config', 'user.name', 'Test']);
    run(['config', 'user.email', 'test@example.com']);
    
    // Setup .gitattributes
    writeFileSync(join(tmpRepo, '.gitattributes'), 'generated.js linguist-generated=true\n');
    
    // Base commit files
    writeFileSync(join(tmpRepo, 'a.js'), 'console.log("Hello");\n');
    writeFileSync(join(tmpRepo, 'config.json'), '{"test": 1}\n');
    writeFileSync(join(tmpRepo, 'old.txt'), 'Rename me\n');
    writeFileSync(join(tmpRepo, 'old edits.txt'), 'Rename with edits\n');
    writeFileSync(join(tmpRepo, 'binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    
    // Add risk area base files
    mkdirSync(join(tmpRepo, 'migrations'));
    mkdirSync(join(tmpRepo, 'auth'));
    mkdirSync(join(tmpRepo, '.github'));
    mkdirSync(join(tmpRepo, '.github/workflows'));
    mkdirSync(join(tmpRepo, 'api'));
    
    writeFileSync(join(tmpRepo, 'migrations/001.sql'), 'CREATE TABLE a (id int);\n');
    writeFileSync(join(tmpRepo, 'auth/login.ts'), 'export const login = () => {};\n');
    writeFileSync(join(tmpRepo, '.github/workflows/ci.yml'), 'name: CI\n');
    
    run(['add', '.']);
    run(['commit', '-m', 'Initial commit']);
    run(['branch', 'base-branch']);
    
    // Head commit
    run(['checkout', '-b', 'head-branch']);
    
    // Modify existing
    writeFileSync(join(tmpRepo, 'a.js'), 'console.log("Hello");\nconsole.log("Modified!");\n');
    
    // Trigger risk areas
    writeFileSync(join(tmpRepo, 'migrations/001.sql'), 'CREATE TABLE a (id int, b int);\n');
    writeFileSync(join(tmpRepo, 'auth/login.ts'), 'export const login = () => { console.log(1); };\n');
    writeFileSync(join(tmpRepo, '.github/workflows/ci.yml'), 'name: CI updated\n');
    writeFileSync(join(tmpRepo, 'api/routes.ts'), 'export const r = [];\n');
    
    // Add new tests
    writeFileSync(join(tmpRepo, 'a.test.ts'), 'test("ok", () => {});\n');
    
    // Add malformed package.json
    writeFileSync(join(tmpRepo, 'package.json'), '{"malformed": "json"');
    
    // Add generated file
    writeFileSync(join(tmpRepo, 'generated.js'), '/* generated */\nvar a = 1;\n');

    // Add lockfile
    writeFileSync(join(tmpRepo, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    
    // Delete config
    run(['rm', 'config.json']);
    
    // Rename without edits
    run(['mv', 'old.txt', 'new.txt']);
    
    // Rename with edits
    run(['mv', 'old edits.txt', 'new edits.txt']);
    writeFileSync(join(tmpRepo, 'new edits.txt'), 'Rename with edits\nAdded line\n');

    const weirdFile = 'weird file.txt';
    writeFileSync(join(tmpRepo, weirdFile), 'weird\n');
    
    writeFileSync(join(tmpRepo, 'binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));

    run(['add', '.']);
    run(['commit', '-m', 'Head changes']);
  });

  afterAll(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('throws on missing merge base', () => {
    expect(() => analyzePullRequest({ repoPath: tmpRepo, baseRef: 'nonexistent', headRef: 'head-branch' })).toThrow(/Failed to find merge base/);
  });

  it('correctly outputs complete v0.1 AnalysisResult schema', () => {
    const result = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'head-branch' });

    expect(result.schemaVersion).toBe(1);
    expect(result.comparison.repoPath).toBe(tmpRepo);
    expect(result.comparison.baseRef).toBe('base-branch');
    expect(result.comparison.headRef).toBe('head-branch');
    expect(typeof result.comparison.mergeBase).toBe('string');
    
    expect(result.summary.filesChanged).toBeGreaterThan(0);
    expect(result.summary.additions).toBeGreaterThan(0);
    expect(result.summary.deletions).toBeGreaterThan(0);
    expect(result.summary.reviewableFiles).toBeGreaterThan(0);
    expect(result.summary.reviewableLines).toBeGreaterThan(0);

    expect(Array.isArray(result.files)).toBe(true);
    expect(result.areas).toBeDefined();
    expect(typeof result.areas.hasMigrations).toBe('boolean');
    expect(typeof result.areas.hasAuthentication).toBe('boolean');
    expect(typeof result.areas.hasCI).toBe('boolean');
    expect(typeof result.areas.hasApiContracts).toBe('boolean');
    expect(typeof result.areas.hasDependencies).toBe('boolean');
    expect(typeof result.areas.hasConfiguration).toBe('boolean');
    
    expect(result.risk).toBeDefined();
    
    // Check expanded evidence
    expect(result.evidence).toBeDefined();
    expect(typeof result.evidence.hasChangedTests).toBe('boolean');
    expect(typeof result.evidence.hasChangedDocs).toBe('boolean');
    expect(typeof result.evidence.hasPackageManifest).toBe('boolean');
    expect(typeof result.evidence.packageManager).toBe('string');
    expect(typeof result.evidence.hasTestScript).toBe('boolean');
    expect(typeof result.evidence.hasTypecheckScript).toBe('boolean');
    expect(typeof result.evidence.hasCiWorkflow).toBe('boolean');

    // lowReviewValueFiles must be full objects
    expect(Array.isArray(result.lowReviewValueFiles)).toBe(true);
    if (result.lowReviewValueFiles.length > 0) {
      const lrvf = result.lowReviewValueFiles[0];
      expect(lrvf.path).toBeDefined();
      expect(lrvf.status).toBeDefined();
      expect(typeof lrvf.additions).toBe('number');
      expect(lrvf.isLowValue).toBe(true);
    }

    expect(Array.isArray(result.reviewFocus)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('correctly maps risk areas', () => {
    const result = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'head-branch' });
    
    expect(result.areas.hasMigrations).toBe(true);
    expect(result.areas.hasAuthentication).toBe(true);
    expect(result.areas.hasCI).toBe(true);
    expect(result.areas.hasApiContracts).toBe(true);
    expect(result.areas.hasDependencies).toBe(true); // package.json, pnpm-lock.yaml
    expect(result.areas.hasConfiguration).toBe(true); // config.json deleted
  });

  it('correctly calculates risk weights (no size penalties)', () => {
    const result = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'head-branch' });
    
    // The exact weights are:
    // migrations (30) + auth (25) + CI (20) + API (15) + deps (15) + config (15) = 120
    // +10 for >= 10 reviewable files (there are 12)
    expect(result.risk.score).toBe(130);
    expect(result.risk.level).toBe('high');
  });

  it('correctly populates repository evidence from disk', () => {
    // Write valid package.json with scripts
    writeFileSync(join(tmpRepo, 'package.json'), JSON.stringify({ scripts: { test: 'vitest', typecheck: 'tsc' } }));
    const result = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'head-branch' });
    
    expect(result.evidence.hasPackageManifest).toBe(true);
    expect(result.evidence.hasTestScript).toBe(true);
    expect(result.evidence.hasTypecheckScript).toBe(true);
    expect(result.evidence.packageManager).toBe('pnpm'); // from pnpm-lock.yaml
    expect(result.evidence.hasCiWorkflow).toBe(true); // from .github/workflows/ci.yml
  });

  it('malformed package.json warns but does not fail', () => {
    writeFileSync(join(tmpRepo, 'package.json'), '{"malformed": "json"');
    const result = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'head-branch' });
    
    expect(result.evidence.hasPackageManifest).toBe(true);
    expect(result.evidence.hasTestScript).toBe(false);
    expect(result.warnings).toContain('package.json is malformed');
  });

  it('prioritizes CI and API over configuration', () => {
    // Generate openapi.yaml and an extra ci yaml in a new branch
    run(['checkout', '-b', 'priority', 'base-branch']);
    writeFileSync(join(tmpRepo, 'openapi.yaml'), 'openapi: 3.0.0\n');
    writeFileSync(join(tmpRepo, '.github/workflows/deploy.yml'), 'name: Deploy\n');
    run(['add', '.']);
    run(['commit', '-m', 'add prioritized files']);

    const result = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'priority' });
    
    // Should trigger API (openapi.yaml) and CI (deploy.yml)
    expect(result.areas.hasApiContracts).toBe(true);
    expect(result.areas.hasCI).toBe(true);
    
    // BUT should NOT trigger Configuration (which also matches .yaml)
    expect(result.areas.hasConfiguration).toBe(false);

    // Score should be 15 (API) + 20 (CI) = 35 + 0 (Size, < 10 files) = 35
    expect(result.risk.score).toBe(35);
  });

  it('counts risk category once globally, not per file', () => {
    run(['checkout', '-b', 'multiple-api', 'base-branch']);
    mkdirSync(join(tmpRepo, 'api', 'v1'), { recursive: true });
    writeFileSync(join(tmpRepo, 'api/routes.ts'), 'export const r = [];\n');
    writeFileSync(join(tmpRepo, 'api/v1/users.ts'), 'export const u = [];\n');
    writeFileSync(join(tmpRepo, 'openapi.yaml'), 'openapi: 3.0.0\n');
    run(['add', '.']);
    run(['commit', '-m', 'multiple api files']);

    const result = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'multiple-api' });
    
    expect(result.areas.hasApiContracts).toBe(true);
    expect(result.areas.hasCI).toBe(false);
    expect(result.areas.hasConfiguration).toBe(false);
    
    // Score should be 15 (API) * 1 = 15. Not 15 * 3 = 45.
    expect(result.risk.score).toBe(15);
  });

  it('proves missing tests do not increase score and present tests do not decrease score', () => {
    // We already have a test file (a.test.ts) in 'head-branch'
    const withTests = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'head-branch' });
    expect(withTests.evidence.hasChangedTests).toBe(true);
    expect(withTests.risk.score).toBe(130); // Just risk areas, size=10, test impact=0

    // Let's create a branch without tests
    run(['checkout', '-b', 'no-tests', 'head-branch']);
    run(['rm', 'a.test.ts']);
    run(['commit', '-m', 'remove tests']);
    
    const withoutTests = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'no-tests' });
    expect(withoutTests.evidence.hasChangedTests).toBe(false);
    
    // The score should STILL be exactly the same, because tests do not add/subtract points
    // (Wait, 'a.test.ts' removal adds a deletion, but still size +10).
    expect(withoutTests.risk.score).toBe(130);

    // However, it should add a warning and review focus
    expect(withoutTests.reviewFocus).toContain('Production changes without tests');
    expect(withoutTests.warnings).toContain('Production changes without tests');
  });

  it('proves exact size band scores (10 and 20)', () => {
    // Generate 10 reviewable files
    run(['checkout', '-b', 'size-10', 'base-branch']);
    for (let i = 0; i < 10; i++) {
      writeFileSync(join(tmpRepo, `file${i}.js`), `console.log(${i});\n`);
    }
    run(['add', '.']);
    run(['commit', '-m', '10 files']);

    const size10 = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'size-10' });
    // Areas: none. So score comes pure from size band. 10 files => +10 points.
    expect(size10.risk.score).toBe(10);

    // Generate 30 reviewable files
    run(['checkout', '-b', 'size-30', 'base-branch']);
    for (let i = 0; i < 30; i++) {
      writeFileSync(join(tmpRepo, `file${i}.js`), `console.log(${i});\n`);
    }
    run(['add', '.']);
    run(['commit', '-m', '30 files']);

    const size30 = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'size-30' });
    // 30 files => +20 points.
    expect(size30.risk.score).toBe(20);

    // Generate 800 lines
    run(['checkout', '-b', 'size-800', 'base-branch']);
    writeFileSync(join(tmpRepo, `large.js`), 'a\n'.repeat(800));
    run(['add', '.']);
    run(['commit', '-m', '800 lines']);

    const size800 = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base-branch', headRef: 'size-800' });
    expect(size800.risk.score).toBe(20);
  });
});

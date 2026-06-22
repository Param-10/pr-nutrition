import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analyzePullRequest } from '../analyzer.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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
    
    run(['add', '.']);
    run(['commit', '-m', 'Initial commit']);
    run(['branch', 'base']);
    
    // Head commit
    run(['checkout', '-b', 'head']);
    
    // Modify existing
    writeFileSync(join(tmpRepo, 'a.js'), 'console.log("Hello");\nconsole.log("Modified!");\n');
    
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

    // Filename with spaces and newlines (if OS supports it, otherwise just spaces)
    const weirdFile = 'weird file.txt';
    writeFileSync(join(tmpRepo, weirdFile), 'weird\n');
    
    // Binary modify
    writeFileSync(join(tmpRepo, 'binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));

    run(['add', '.']);
    run(['commit', '-m', 'Head changes']);
  });

  afterAll(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('throws on missing merge base', () => {
    expect(() => analyzePullRequest({ repoPath: tmpRepo, baseRef: 'nonexistent', headRef: 'head' })).toThrow(/Failed to find merge base/);
  });

  it('correctly analyzes changes', () => {
    const result = analyzePullRequest({ repoPath: tmpRepo, baseRef: 'base', headRef: 'head' });

    expect(result.files).toBeDefined();
    
    // Check file classifications
    const aTxt = result.files.find(f => f.path === 'a.js');
    expect(aTxt?.status).toBe('modified');
    expect(aTxt?.additions).toBe(1);
    expect(aTxt?.deletions).toBe(0);
    expect(aTxt?.classification.isTest).toBe(false);

    const aTest = result.files.find(f => f.path === 'a.test.ts');
    expect(aTest?.status).toBe('added');
    expect(aTest?.classification.isTest).toBe(true);

    const config = result.files.find(f => f.path === 'config.json');
    expect(config?.status).toBe('deleted');
    expect(config?.classification.isConfig).toBe(true);

    const rename = result.files.find(f => f.path === 'new.txt');
    expect(rename?.status).toBe('renamed');
    expect(rename?.additions).toBe(0);
    expect(rename?.deletions).toBe(0);

    const renameEdit = result.files.find(f => f.path === 'new edits.txt');
    expect(renameEdit?.status).toBe('renamed');
    expect(renameEdit?.additions).toBe(1);
    
    const binary = result.files.find(f => f.path === 'binary.png');
    expect(binary?.status).toBe('modified');
    expect(binary?.additions).toBe(0);
    expect(binary?.deletions).toBe(0);

    const lockfile = result.files.find(f => f.path === 'pnpm-lock.yaml');
    expect(lockfile?.classification.isLowValue).toBe(true);

    const generated = result.files.find(f => f.path === 'generated.js');
    expect(generated?.classification.isGenerated).toBe(true);
    expect(generated?.classification.isLowValue).toBe(true);

    const pkg = result.files.find(f => f.path === 'package.json');
    expect(pkg?.status).toBe('added');

    // Check evidence
    expect(result.evidence.hasTests).toBe(true);
    expect(result.evidence.hasConfigChanges).toBe(true);

    // Check risk (tests don't mitigate!)
    // meaningful modifications: a.js, a.test.ts, package.json, new edits.txt, weird file.txt (all low line counts)
    // score should be 0 because linesChanged < 200, files < 20, tests present.
    expect(result.risk.score).toBe(0);
    expect(result.risk.level).toBe('low');

    // Check merge base explicitly
    expect(result.comparison.mergeBase).toBeDefined();
    expect(result.comparison.mergeBase.length).toBeGreaterThan(0);
  });
});

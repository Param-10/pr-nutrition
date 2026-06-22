import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analyzePR } from '../analyzer.js';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Core Analyzer', () => {
  let tmpRepo: string;

  beforeAll(() => {
    tmpRepo = mkdtempSync(join(tmpdir(), 'pr-nutrition-test-'));
    
    const run = (cmd: string) => execSync(cmd, { cwd: tmpRepo });
    
    // Initialize repo
    run('git init');
    run('git config user.name "Test"');
    run('git config user.email "test@example.com"');
    
    // Base commit
    writeFileSync(join(tmpRepo, 'a.js'), 'console.log("Hello");\n');
    writeFileSync(join(tmpRepo, 'config.json'), '{"test": 1}\n');
    writeFileSync(join(tmpRepo, 'old.txt'), 'Rename me\n');
    run('git add .');
    run('git commit -m "Initial commit"');
    run('git branch base');
    
    // Head commit
    run('git checkout -b head');
    
    // Modify existing
    writeFileSync(join(tmpRepo, 'a.js'), 'console.log("Hello");\nconsole.log("Modified!");\n');
    
    // Add new tests
    writeFileSync(join(tmpRepo, 'a.test.ts'), 'test("ok", () => {});\n');
    
    // Delete config
    run('git rm config.json');
    
    // Rename
    run('git mv old.txt new.txt');
    
    run('git add .');
    run('git commit -m "Head changes"');
  });

  afterAll(() => {
    rmSync(tmpRepo, { recursive: true, force: true });
  });

  it('correctly analyzes changes', () => {
    const result = analyzePR('base', 'head', tmpRepo);

    expect(result.files).toBeDefined();
    
    // Check file classifications
    const aTxt = result.files.find(f => f.path === 'a.js');
    expect(aTxt?.status).toBe('modified');
    expect(aTxt?.additions).toBe(1);
    expect(aTxt?.deletions).toBe(0);

    const testFile = result.files.find(f => f.path === 'a.test.ts');
    expect(testFile?.status).toBe('added');
    expect(testFile?.additions).toBe(1);

    const config = result.files.find(f => f.path === 'config.json');
    expect(config?.status).toBe('deleted');

    const newTxt = result.files.find(f => f.path === 'new.txt');
    expect(newTxt?.status).toBe('renamed');

    // Check evidence
    expect(result.evidence.hasTests).toBe(true);
    // Config was deleted but it was a config file, so it touched config
    expect(result.evidence.hasConfigChanges).toBe(true);
    expect(result.evidence.hasDocs).toBe(true);

    // Check risk
    // Mitigated by tests
    expect(result.risk.level).toBe('low');
    expect(result.risk.score).toBe(0);
  });
});

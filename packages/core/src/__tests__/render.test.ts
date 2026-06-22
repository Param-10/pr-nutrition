import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderJson } from '../render.js';
import type { AnalysisResult } from '../types.js';

const fixturesDir = join(__dirname, '__fixtures__');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

const fullResult: AnalysisResult = {
  schemaVersion: 1,
  comparison: {
    repoPath: '/tmp/repo',
    baseRef: 'main',
    headRef: 'HEAD',
    mergeBase: 'abcdef'
  },
  summary: {
    filesChanged: 12,
    additions: 300,
    deletions: 50,
    reviewableFiles: 8,
    reviewableLines: 250
  },
  files: [],
  areas: [
    { id: 'authentication', label: 'Authentication and security', files: ['src/auth/session.ts'] }
  ],
  risk: {
    score: 35,
    level: 'medium',
    reasons: [
      { description: 'Authentication/security logic changed', points: 25 },
      { description: 'Size: 10+ reviewable files or 200+ reviewable lines', points: 10 }
    ]
  },
  evidence: {
    hasChangedTests: true,
    hasChangedDocs: false,
    hasPackageManifest: true,
    manifests: ['package.json'],
    packageManager: 'pnpm',
    hasTestScript: true,
    hasTypecheckScript: true,
    hasCiWorkflow: true
  },
  lowReviewValueFiles: [
    { path: 'pnpm-lock.yaml', status: 'modified', additions: 50, deletions: 10, isBinary: false, isGenerated: false, isLowValue: true },
    { path: 'docs/generated.md', status: 'modified', additions: 0, deletions: 0, isBinary: false, isGenerated: true, isLowValue: true },
    { path: 'space file.txt', status: 'added', additions: 5, deletions: 0, isBinary: false, isGenerated: false, isLowValue: true },
    { path: 'new\nline.txt', status: 'added', additions: 5, deletions: 0, isBinary: false, isGenerated: false, isLowValue: true }
  ],
  reviewFocus: [
    'Production changes without tests',
    'Ensure auth modifications are strictly scoped'
  ],
  warnings: [
    'package.json could not be parsed'
  ]
};

const minimalResult: AnalysisResult = {
  schemaVersion: 1,
  comparison: {
    repoPath: '/tmp/repo',
    baseRef: 'main',
    headRef: 'HEAD',
    mergeBase: 'abcdef'
  },
  summary: {
    filesChanged: 2,
    additions: 10,
    deletions: 5,
    reviewableFiles: 2,
    reviewableLines: 15
  },
  files: [],
  areas: [],
  risk: {
    score: 0,
    level: 'low',
    reasons: []
  },
  evidence: {
    hasChangedTests: false,
    hasChangedDocs: false,
    hasPackageManifest: false,
    manifests: [],
    packageManager: 'unknown',
    hasTestScript: false,
    hasTypecheckScript: false,
    hasCiWorkflow: false
  },
  lowReviewValueFiles: [],
  reviewFocus: [],
  warnings: []
};

describe('Renderers', () => {
  it('matches full golden fixtures', () => {
    expect(renderMarkdown(fullResult)).toBe(readFixture('full.md'));
    expect(renderJson(fullResult)).toBe(readFixture('full.json'));
  });

  it('matches minimal golden fixtures', () => {
    expect(renderMarkdown(minimalResult)).toBe(readFixture('minimal.md'));
    expect(renderJson(minimalResult)).toBe(readFixture('minimal.json'));
  });

  it('output ends with exactly one newline', () => {
    const md = renderMarkdown(minimalResult);
    const json = renderJson(minimalResult);
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
    expect(json.endsWith('\n')).toBe(true);
    expect(json.endsWith('\n\n')).toBe(false);
  });

  it('inline code handles backticks safely', () => {
    const maliciousResult: AnalysisResult = {
      ...minimalResult,
      comparison: {
        ...minimalResult.comparison,
        baseRef: '`main`'
      }
    };
    const md = renderMarkdown(maliciousResult);
    // Should use double backticks to fence single backtick: `` `main` ``
    expect(md).toContain('`` `main` ``');
  });

  it('file paths with newline/tab are displayed safely', () => {
    // verified by full.md fixture as well
    const md = renderMarkdown(fullResult);
    expect(md).toContain('`new\\nline.txt`');
    expect(md).not.toContain('`new\nline.txt`');
  });

  it('file paths cannot inject terminal control characters into Markdown', () => {
    const controlResult: AnalysisResult = {
      ...minimalResult,
      lowReviewValueFiles: [
        {
          path: '\u001b[31m-danger.png',
          status: 'added',
          additions: 0,
          deletions: 0,
          isBinary: true,
          isGenerated: false,
          isLowValue: true
        }
      ]
    };
    const md = renderMarkdown(controlResult);
    expect(md).toContain('`\\x1b[31m-danger.png`');
    expect(md).not.toContain('\u001b');
  });

  it('JSON top-level key order is stable', () => {
    const json = renderJson(minimalResult);
    const keys = Object.keys(JSON.parse(json));
    const expectedKeys = [
      'schemaVersion',
      'comparison',
      'summary',
      'files',
      'areas',
      'risk',
      'evidence',
      'lowReviewValueFiles',
      'reviewFocus',
      'warnings'
    ];
    expect(keys).toEqual(expectedKeys);
    
    // Check exact string index sequence to prove stringify order
    const str = json;
    const idxSchema = str.indexOf('"schemaVersion"');
    const idxComparison = str.indexOf('"comparison"');
    const idxRisk = str.indexOf('"risk"');
    const idxWarnings = str.indexOf('"warnings"');
    
    expect(idxSchema).toBeLessThan(idxComparison);
    expect(idxComparison).toBeLessThan(idxRisk);
    expect(idxRisk).toBeLessThan(idxWarnings);
  });
});

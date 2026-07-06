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
  ],
  explanations: []
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
  warnings: [],
  explanations: []
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

  it('omits the Explanation section by default and includes it with explain', () => {
    const withExplanations: AnalysisResult = {
      ...minimalResult,
      explanations: [
        {
          path: 'src/auth/session.ts',
          kind: 'risk-area',
          area: 'authentication',
          ruleId: 'builtin.path.authentication',
          source: 'builtin',
          reason: 'Path matched the built-in authentication and security rule.'
        },
        {
          path: 'src/generated/client.ts',
          kind: 'generated',
          ruleId: 'config.paths.generated',
          source: 'config',
          reason: 'Path matched the config generated pattern src/generated/**.',
          pattern: 'src/generated/**'
        }
      ]
    };
    expect(renderMarkdown(withExplanations)).not.toContain('## Explanation');
    const explained = renderMarkdown(withExplanations, { explain: true });
    expect(explained).toContain('## Explanation');
    expect(explained).toContain('`builtin.path.authentication`');
    expect(explained).toContain('Source: config');
    expect(explained).toContain('Pattern: `src/generated/**`');
    expect(explained).toContain('Risk area: authentication');
  });

  it('handles explain rendering safely when explanations are missing', () => {
    const withoutExplanations: AnalysisResult = { ...minimalResult };
    delete withoutExplanations.explanations;
    expect(renderMarkdown(withoutExplanations, { explain: true })).not.toContain('## Explanation');
    expect(JSON.parse(renderJson(withoutExplanations, { explain: true }))).not.toHaveProperty('explanations');
  });

  it('uses copy wording for copied-file explanations', () => {
    const withCopy: AnalysisResult = {
      ...minimalResult,
      explanations: [
        {
          path: 'src/copied.ts',
          kind: 'copy',
          ruleId: 'builtin.git.copy',
          source: 'git',
          reason: 'File copied from src/source.ts.'
        }
      ]
    };
    const md = renderMarkdown(withCopy, { explain: true });
    expect(md).toContain('— Copy');
    expect(md).toContain('File copied from src/source.ts.');
    expect(md).not.toContain('— Rename');

    const json = JSON.parse(renderJson(withCopy, { explain: true }));
    expect(json.explanations[0]).toMatchObject({
      kind: 'copy',
      ruleId: 'builtin.git.copy'
    });
  });

  it('escapes control characters in explanation paths', () => {
    const controlResult: AnalysisResult = {
      ...minimalResult,
      explanations: [
        {
          path: '\u001b[31msrc/evil.ts',
          kind: 'generated',
          ruleId: 'builtin.path.generated',
          source: 'builtin',
          reason: 'Path matched a built-in generated-file rule.'
        }
      ]
    };
    const md = renderMarkdown(controlResult, { explain: true });
    expect(md).toContain('`\\x1b[31msrc/evil.ts`');
    expect(md).not.toContain('\u001b');
  });

  it('caps the Markdown explanation list at 30 entries', () => {
    const explanations: NonNullable<AnalysisResult['explanations']> = Array.from({ length: 42 }, (_, index) => ({
      path: `src/file-${String(index).padStart(3, '0')}.ts`,
      kind: 'generated' as const,
      ruleId: 'builtin.path.generated',
      source: 'builtin' as const,
      reason: 'Path matched a built-in generated-file rule.'
    }));
    const md = renderMarkdown({ ...minimalResult, explanations }, { explain: true });
    expect(md).toContain('...and 12 more');
  });

  it('omits explanations from JSON by default and includes all with explain', () => {
    const explanations: NonNullable<AnalysisResult['explanations']> = [
      {
        path: 'a.ts',
        kind: 'generated',
        ruleId: 'builtin.path.generated',
        source: 'builtin',
        reason: 'Path matched a built-in generated-file rule.'
      }
    ];
    const withExplanations = { ...minimalResult, explanations };
    expect(JSON.parse(renderJson(withExplanations))).not.toHaveProperty('explanations');
    const explained = JSON.parse(renderJson(withExplanations, { explain: true }));
    expect(explained.explanations).toHaveLength(1);
    expect(Object.keys(explained).at(-1)).toBe('explanations');
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

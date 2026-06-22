import type { ChangedFile } from './types.js';

export function classifyFiles(files: ChangedFile[]): void {
  for (const file of files) {
    file.classification.isTest = isTestFile(file.path);
    file.classification.isDoc = isDocFile(file.path);
    file.classification.isConfig = isConfigFile(file.path);
    file.classification.isLowValue = file.classification.isGenerated || isLowValueFile(file.path);
  }
}

function isTestFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.includes('__tests__') ||
    lowerPath.includes('test/') ||
    lowerPath.includes('tests/') ||
    lowerPath.endsWith('.test.ts') ||
    lowerPath.endsWith('.test.js') ||
    lowerPath.endsWith('.spec.ts') ||
    lowerPath.endsWith('.spec.js')
  );
}

function isDocFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.endsWith('.md') ||
    lowerPath.endsWith('.mdx') ||
    lowerPath.endsWith('.txt') ||
    lowerPath.includes('docs/')
  );
}

function isConfigFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.endsWith('.json') ||
    lowerPath.endsWith('.yml') ||
    lowerPath.endsWith('.yaml') ||
    lowerPath.includes('.github/') ||
    lowerPath.endsWith('.config.js') ||
    lowerPath.endsWith('.config.ts')
  );
}

function isLowValueFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath === 'pnpm-lock.yaml' ||
    lowerPath === 'package-lock.json' ||
    lowerPath === 'yarn.lock' ||
    lowerPath.endsWith('.svg') ||
    lowerPath.endsWith('.png') ||
    lowerPath.endsWith('.snap')
  );
}

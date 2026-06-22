export function isTestFile(path: string): boolean {
  return (
    path.includes('/__tests__/') ||
    path.includes('/tests/') ||
    path.includes('/test/') ||
    path.endsWith('.test.ts') ||
    path.endsWith('.spec.ts') ||
    path.endsWith('.test.js') ||
    path.endsWith('.spec.js')
  );
}

export function isDocFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.endsWith('.md') ||
    lowerPath.endsWith('.mdx') ||
    lowerPath.endsWith('.txt') ||
    lowerPath.includes('/docs/') ||
    lowerPath === 'license' ||
    lowerPath === 'readme'
  );
}

export function isConfigFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.includes('.github/') ||
    lowerPath.includes('.vscode/') ||
    lowerPath.includes('tsconfig') ||
    lowerPath.includes('eslint.config') ||
    lowerPath.includes('prettier.config') ||
    lowerPath.includes('jest.config') ||
    lowerPath.includes('vitest.config') ||
    lowerPath.endsWith('.yaml') ||
    lowerPath.endsWith('.yml') ||
    lowerPath.endsWith('.json')
  );
}

export function isGeneratedFile(path: string): boolean {
  return (
    path.includes('package-lock.json') ||
    path.includes('pnpm-lock.yaml') ||
    path.includes('yarn.lock') ||
    path.includes('/dist/') ||
    path.includes('/build/') ||
    path.includes('/coverage/')
  );
}

export function isLowValueFile(path: string): boolean {
  return isGeneratedFile(path) || isDocFile(path) || isConfigFile(path);
}

export function isTestFile(path: string): boolean {
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

export function isDocFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.endsWith('.md') ||
    lowerPath.endsWith('.mdx') ||
    lowerPath.endsWith('.txt') ||
    lowerPath.includes('docs/')
  );
}

export function isLowValueFile(path: string): boolean {
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

// Strict Priority-based Risk Area Matcher
export type RiskArea = 'migrations' | 'authentication' | 'ci' | 'api' | 'dependencies' | 'configuration' | 'none';

export function getRiskArea(path: string): RiskArea {
  const lowerPath = path.toLowerCase();
  
  if (lowerPath.includes('migrations/') || lowerPath.includes('db/migrate/')) {
    return 'migrations';
  }
  
  if (lowerPath.includes('auth/') || lowerPath.includes('security/') || lowerPath.includes('login') || lowerPath.includes('permissions') || lowerPath.includes('roles')) {
    return 'authentication';
  }
  
  if (lowerPath.includes('.github/workflows/') || lowerPath.includes('.circleci/') || lowerPath.includes('.gitlab-ci.yml')) {
    return 'ci';
  }
  
  if (lowerPath.includes('api/') || lowerPath.includes('openapi.yaml') || lowerPath.includes('swagger') || lowerPath.includes('types/') || lowerPath.includes('interfaces/')) {
    return 'api';
  }
  
  if (lowerPath.endsWith('package.json') || lowerPath === 'yarn.lock' || lowerPath === 'pnpm-lock.yaml' || lowerPath === 'package-lock.json') {
    return 'dependencies';
  }
  
  if (lowerPath.endsWith('.env') || lowerPath.includes('config/') || lowerPath.includes('.config.') || lowerPath.endsWith('rc') || lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml') || lowerPath.endsWith('.json')) {
    return 'configuration';
  }
  
  return 'none';
}

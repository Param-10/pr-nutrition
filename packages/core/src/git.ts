import { execFileSync } from 'node:child_process';
import type { ChangedFile, FileStatus } from './types.js';

export interface GitDiffResult {
  files: ChangedFile[];
  mergeBase: string;
}

export function getGitDiff(baseRef: string, headRef: string, cwd: string = process.cwd()): GitDiffResult {
  // 1. Get merge base
  let mergeBase: string;
  try {
    mergeBase = execFileSync('git', ['merge-base', baseRef, headRef], { cwd, encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error(`Failed to find merge base between ${baseRef} and ${headRef}`, { cause: error });
  }

  // 2. Run diff commands
  const diffArgs = ['-M', '-z', mergeBase, headRef];
  const nameStatusOut = execFileSync('git', ['diff', '--name-status', ...diffArgs], { cwd, encoding: 'utf8' });
  const numstatOut = execFileSync('git', ['diff', '--numstat', ...diffArgs], { cwd, encoding: 'utf8' });

  const statuses = parseNameStatus(nameStatusOut);
  const stats = parseNumstat(numstatOut);

  // 3. Check attributes for linguist-generated
  const pathsToCheck = Array.from(statuses.keys());
  let generatedMap = new Map<string, boolean>();
  if (pathsToCheck.length > 0) {
    const input = pathsToCheck.join('\0') + '\0';
    const attrOut = execFileSync('git', ['check-attr', '-z', '--stdin', 'linguist-generated'], {
      cwd,
      encoding: 'utf8',
      input,
    });
    generatedMap = parseCheckAttr(attrOut);
  }

  const files: ChangedFile[] = [];

  for (const stat of stats) {
    const statusData = statuses.get(stat.path);
    const status = statusData || 'modified';

    const isGenerated = generatedMap.get(stat.path) === true;

    files.push({
      path: stat.path,
      status,
      additions: stat.additions,
      deletions: stat.deletions,
      classification: {
        isTest: false,
        isDoc: false,
        isConfig: false,
        isGenerated,
        isLowValue: false,
      },
    });
  }

  return { files, mergeBase };
}

function parseNameStatus(output: string): Map<string, FileStatus> {
  const map = new Map<string, FileStatus>();
  if (!output) return map;

  const parts = output.split('\0');
  for (let i = 0; i < parts.length - 1; ) {
    const statusStr = parts[i++];
    if (!statusStr) continue;
    const code = statusStr.charAt(0);

    if (code === 'R' || code === 'C') {
      const oldPath = parts[i++]; // eslint-disable-line @typescript-eslint/no-unused-vars
      const newPath = parts[i++];
      if (newPath) {
        map.set(newPath, code === 'R' ? 'renamed' : 'copied');
      }
    } else {
      const path = parts[i++];
      if (path) {
        let status: FileStatus = 'unknown';
        if (code === 'A') status = 'added';
        else if (code === 'M') status = 'modified';
        else if (code === 'D') status = 'deleted';
        map.set(path, status);
      }
    }
  }
  return map;
}

function parseNumstat(output: string): Array<{ path: string; additions: number; deletions: number }> {
  const result: Array<{ path: string; additions: number; deletions: number }> = [];
  if (!output) return result;

  const parts = output.split('\0');
  for (let i = 0; i < parts.length - 1; i++) {
    const chunk = parts[i];
    if (!chunk) continue;

    const tabSplit = chunk.split('\t');
    const addsStr = tabSplit[0];
    const delsStr = tabSplit[1];
    let path = tabSplit[2];

    if (path === '') {
      // It's a rename or copy
      const oldPath = parts[++i]; // eslint-disable-line @typescript-eslint/no-unused-vars
      const newPath = parts[++i];
      path = newPath;
    }

    if (!path) continue;

    const additions = addsStr === '-' ? 0 : parseInt(addsStr as string, 10);
    const deletions = delsStr === '-' ? 0 : parseInt(delsStr as string, 10);

    result.push({ path, additions, deletions });
  }

  return result;
}

function parseCheckAttr(output: string): Map<string, boolean> {
  const map = new Map<string, boolean>();
  if (!output) return map;

  const parts = output.split('\0');
  // path, attribute, value
  for (let i = 0; i < parts.length - 1; i += 3) {
    const path = parts[i];
    // const attr = parts[i + 1]; // "linguist-generated"
    const val = parts[i + 2];
    
    if (path && val === 'true') {
      map.set(path, true);
    }
  }

  return map;
}

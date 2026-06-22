import { execSync } from 'node:child_process';
import type { FileChange, FileStatus } from './types.js';

export function getGitDiff(base: string, head: string, cwd: string = process.cwd()): FileChange[] {
  // Use -M to detect renames, --find-renames
  const diffCommandOptions = `-M -z ${base}...${head}`;
  
  const nameStatusOut = execSync(`git diff --name-status ${diffCommandOptions}`, { cwd, encoding: 'utf8' });
  const numstatOut = execSync(`git diff --numstat ${diffCommandOptions}`, { cwd, encoding: 'utf8' });

  const statuses = parseNameStatus(nameStatusOut);
  const stats = parseNumstat(numstatOut);

  const files: FileChange[] = [];

  for (const stat of stats) {
    const statusData = statuses.get(stat.path);
    // If a file appears in numstat but not name-status, fallback to 'modified'
    const status = statusData || 'modified';

    files.push({
      path: stat.path,
      status,
      additions: stat.additions,
      deletions: stat.deletions,
      isLowValue: false,
      isGenerated: false,
    });
  }

  // Handle files that are in nameStatus but not in numstat (e.g. empty files added/deleted, or binary files that numstat might skip if there's no addition/deletion reported?)
  // Actually, numstat includes binary files as "-\t-\tpath" which our parseNumstat handles as 0 additions/deletions.
  // Empty files added might show up as "0\t0\tpath".
  // So stats should have exactly the same files as statuses.

  return files;
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
        map.set(newPath, code === 'R' ? 'renamed' : 'added');
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
    if (!chunk) continue; // safety check

    const tabSplit = chunk.split('\t');
    const addsStr = tabSplit[0];
    const delsStr = tabSplit[1];
    let path = tabSplit[2];

    if (path === '') {
      // It's a rename in numstat
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

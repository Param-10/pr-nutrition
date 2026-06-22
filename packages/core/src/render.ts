import type { AnalysisResult } from './types.js';

function boolText(value: boolean): 'Yes' | 'No' {
  return value ? 'Yes' : 'No';
}

function titleCaseRisk(level: 'low' | 'medium' | 'high'): 'Low' | 'Medium' | 'High' {
  if (level === 'low') return 'Low';
  if (level === 'medium') return 'Medium';
  return 'High';
}

function displayPath(path: string): string {
  return Array.from(path, (character) => {
    const code = character.charCodeAt(0);
    if (code > 0x1f && code !== 0x7f) return character;
    if (character === '\r') return '\\r';
    if (character === '\n') return '\\n';
    if (character === '\t') return '\\t';
    return `\\x${code.toString(16).padStart(2, '0')}`;
  }).join('');
}

function inlineCode(value: string): string {
  const matches = Array.from(value.matchAll(/`+/g), (match) => match[0].length);
  const maxRun = matches.length > 0 ? Math.max(...matches) : 0;
  const fence = '`'.repeat(maxRun + 1);
  if (value.startsWith('`') || value.endsWith('`')) {
    return `${fence} ${value} ${fence}`;
  }
  return `${fence}${value}${fence}`;
}

export function renderJson(result: AnalysisResult): string {
  const normalized = {
    schemaVersion: result.schemaVersion,
    comparison: {
      repoPath: result.comparison.repoPath,
      baseRef: result.comparison.baseRef,
      headRef: result.comparison.headRef,
      mergeBase: result.comparison.mergeBase,
    },
    summary: {
      filesChanged: result.summary.filesChanged,
      additions: result.summary.additions,
      deletions: result.summary.deletions,
      reviewableFiles: result.summary.reviewableFiles,
      reviewableLines: result.summary.reviewableLines,
    },
    files: result.files,
    areas: result.areas,
    risk: {
      score: result.risk.score,
      level: result.risk.level,
      reasons: result.risk.reasons,
    },
    evidence: result.evidence,
    lowReviewValueFiles: result.lowReviewValueFiles,
    reviewFocus: result.reviewFocus,
    warnings: result.warnings,
  };

  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function renderMarkdown(result: AnalysisResult): string {
  const parts: string[] = [];

  // Header and Risk
  parts.push('# PR Nutrition');
  parts.push(`**Risk:** ${titleCaseRisk(result.risk.level)} (${result.risk.score}/100)`);

  // Scope
  const scopeLines = [
    '## Scope',
    '',
    `- Total changes: ${result.summary.filesChanged} files, +${result.summary.additions} / -${result.summary.deletions}`,
    `- Reviewable: ${result.summary.reviewableFiles} files, ${result.summary.reviewableLines} lines`,
    `- Base: ${inlineCode(result.comparison.baseRef)}`,
    `- Head: ${inlineCode(result.comparison.headRef)}`
  ];
  parts.push(scopeLines.join('\n'));

  if (result.areas.length > 0) {
    const areaLines = ['## Changed areas', ''];
    for (const area of result.areas) {
      const count = area.files.length;
      areaLines.push(`- ${area.label}: ${count} ${count === 1 ? 'file' : 'files'}`);
    }
    parts.push(areaLines.join('\n'));
  }

  // Review Focus
  if (result.reviewFocus.length > 0) {
    const focusLines = ['## Review focus', ''];
    for (const focus of result.reviewFocus) {
      focusLines.push(`- ${focus}`);
    }
    parts.push(focusLines.join('\n'));
  }

  // Risk Reasons
  if (result.risk.reasons.length > 0) {
    const riskLines = ['## Risk reasons', ''];
    for (const reason of result.risk.reasons) {
      riskLines.push(`- ${reason.description} (+${reason.points})`);
    }
    parts.push(riskLines.join('\n'));
  }

  // Repository Evidence
  const pkgMgrDisplay = result.evidence.packageManager === 'unknown'
    ? 'Unknown'
    : inlineCode(result.evidence.packageManager);

  const evidenceLines = [
    '## Repository evidence',
    '',
    `- Package manager: ${pkgMgrDisplay}`,
    `- Package manifest: ${boolText(result.evidence.hasPackageManifest)}`,
    `- Manifests: ${result.evidence.manifests.length > 0 ? result.evidence.manifests.map(inlineCode).join(', ') : 'None'}`,
    `- Test script: ${boolText(result.evidence.hasTestScript)}`,
    `- Typecheck script: ${boolText(result.evidence.hasTypecheckScript)}`,
    `- CI workflow: ${boolText(result.evidence.hasCiWorkflow)}`,
    `- Changed tests: ${boolText(result.evidence.hasChangedTests)}`,
    `- Changed docs: ${boolText(result.evidence.hasChangedDocs)}`
  ];
  parts.push(evidenceLines.join('\n'));

  // Low review-value files
  if (result.lowReviewValueFiles.length > 0) {
    const count = result.lowReviewValueFiles.length;
    const lrvfLines = [
      '## Low review-value files',
      '',
      '<details>',
      `<summary>${count} ${count === 1 ? 'file' : 'files'}</summary>`,
      ''
    ];

    const limit = 20;
    const toShow = result.lowReviewValueFiles.slice(0, limit);
    for (const file of toShow) {
      const safePath = inlineCode(displayPath(file.path));
      const previousPath = file.previousPath === undefined
        ? ''
        : `${inlineCode(displayPath(file.previousPath))} → `;
      const binary = file.isBinary ? ', binary' : '';
      lrvfLines.push(`- ${previousPath}${safePath} — ${file.status}${binary}, +${file.additions} / -${file.deletions}`);
    }

    if (count > limit) {
      lrvfLines.push(`- ...and ${count - limit} more`);
    }

    lrvfLines.push('');
    lrvfLines.push('</details>');
    parts.push(lrvfLines.join('\n'));
  }

  // Warnings
  if (result.warnings.length > 0) {
    const warningLines = ['## Warnings', ''];
    for (const warning of result.warnings) {
      warningLines.push(`- ${warning}`);
    }
    parts.push(warningLines.join('\n'));
  }

  // Footer
  parts.push('---\nGenerated by PR Nutrition.');

  return parts.join('\n\n') + '\n';
}

// Renames CHANGELOG.md's "## Unreleased" section to a version heading and opens a fresh
// empty "## Unreleased" section above it. No-op if Unreleased has no content, so a release
// with no user-facing changes doesn't create a dud empty version header.
//
// Usage: node scripts/cut-changelog-release.mjs <version>

import { readFileSync, writeFileSync } from 'fs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/cut-changelog-release.mjs <version>');
  process.exit(1);
}

const path = 'CHANGELOG.md';
const lines = readFileSync(path, 'utf8').split('\n');

const unreleasedIndex = lines.findIndex(line => line === '## Unreleased');
if (unreleasedIndex === -1) {
  console.error('CHANGELOG.md has no "## Unreleased" heading.');
  process.exit(1);
}

let nextHeadingIndex = lines.findIndex(
  (line, i) => i > unreleasedIndex && line.startsWith('## '),
);
if (nextHeadingIndex === -1) {
  nextHeadingIndex = lines.length;
}

const content = lines.slice(unreleasedIndex + 1, nextHeadingIndex);
if (!content.some(line => line.trim() !== '')) {
  console.log('Unreleased section is empty, nothing to cut.');
  process.exit(0);
}

const newLines = [
  ...lines.slice(0, unreleasedIndex),
  '## Unreleased',
  '',
  `## ${version}`,
  ...lines.slice(unreleasedIndex + 1),
];

writeFileSync(path, newLines.join('\n'));
console.log(`Cut Unreleased into ## ${version}.`);

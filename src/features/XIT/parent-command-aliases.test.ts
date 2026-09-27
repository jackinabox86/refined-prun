import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Parent refined-prun 26.9.15/26.9.16 shortened these names. The fork keeps its
// full name first — XIT CMDS shows that token — and accepts the parent token too.
// xit-registry indexes every command-array entry, so the strings here are the lookup.
const PARENT_ALIASES: Record<string, string> = {
  AGT: 'AGENT',
  DSP: 'DISPATCH',
  DISPATCHEXEC: 'DISPATCHACT',
  PLS: 'PLANETS',
};

const here = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
      continue;
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(path);
    }
  }
  return files;
}

function commandGroups(sourceRoot: string): string[][] {
  const groups: string[][] = [];
  const pattern = /command:\s*(\[[^\]]+\]|'[A-Z0-9 ]+')/g;
  for (const file of walk(sourceRoot)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      const raw = match[1];
      const names = raw.startsWith('[')
        ? [...raw.matchAll(/'([^']+)'/g)].map(x => x[1])
        : [raw.slice(1, -1)];
      groups.push(names);
    }
  }
  return groups;
}

describe('parent XIT command aliases', () => {
  const groups = commandGroups(here);
  const counts = new Map<string, number>();
  for (const names of groups) {
    for (const name of names) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  it('keeps the fork full name first and registers each parent short name once', () => {
    for (const [alias, fullName] of Object.entries(PARENT_ALIASES)) {
      const group = groups.find(x => x.includes(alias));
      expect(group?.[0], alias).toBe(fullName);
      expect(counts.get(alias), alias).toBe(1);
      expect(counts.get(fullName), fullName).toBe(1);
    }
  });
});

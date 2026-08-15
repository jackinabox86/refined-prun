import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createFirefoxVersion } from './firefox-version.mjs';

function compareVersion(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

describe('createFirefoxVersion', () => {
  it('keeps the Firefox update stream above legacy date-stamped releases', () => {
    const version = createFirefoxVersion(new Date('2026-08-14T12:00:00.000Z'), 19);

    expect(version).toBe('2026.8.14.19');
    expect(compareVersion(version, '2026.8.9.18')).toBeGreaterThan(0);
  });

  it('uses the UTC calendar day and run number for repeat-release ordering', () => {
    const date = new Date('2026-08-14T23:30:00.000Z');

    expect(createFirefoxVersion(date, 19)).toBe('2026.8.14.19');
    expect(createFirefoxVersion(date, '19')).toBe('2026.8.14.19');
    expect(
      compareVersion(createFirefoxVersion(date, 20), createFirefoxVersion(date, 19)),
    ).toBeGreaterThan(0);
  });

  it('accepts a run number passed on the command line', () => {
    const version = execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./firefox-version.mjs', import.meta.url)), '19'],
      { encoding: 'utf8' },
    );

    expect(version).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}\.19\n$/);
  });
});

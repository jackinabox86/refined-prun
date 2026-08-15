import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createFirefoxVersion } from './firefox-version.mjs';

const repositoryDirectory = fileURLToPath(new URL('..', import.meta.url));
const bashAvailable = spawnSync('bash', ['--version'], { stdio: 'ignore' }).status === 0;

function firefoxStampVersionScript(runNumber) {
  const workflow = readFileSync(
    join(repositoryDirectory, '.github/workflows/release-firefox.yml'),
    'utf8',
  );
  const step = workflow.match(
    /      - name: Stamp version\r?\n        run: \|\r?\n((?:          .*\r?\n?)*)/,
  );

  if (step === null) {
    throw new Error('Could not find the Firefox Stamp version workflow step.');
  }

  return step[1].replace(/^ {10}/gm, '').replace('${{ github.run_number }}', String(runNumber));
}

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

  it.skipIf(!bashAvailable)('executes the shipped Firefox stamp workflow step under Bash', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'firefox-version-test-'));
    const binDirectory = join(temporaryDirectory, 'bin');
    const scriptPath = join(temporaryDirectory, 'stamp-version.sh');
    const stampedVersionPath = join(temporaryDirectory, 'stamped-version');

    try {
      mkdirSync(binDirectory);
      writeFileSync(
        join(binDirectory, 'npx'),
        '#!/usr/bin/env bash\nprintf %s "$4" > "$STAMPED_VERSION"\n',
      );
      chmodSync(join(binDirectory, 'npx'), 0o755);
      writeFileSync(scriptPath, firefoxStampVersionScript(19));

      execFileSync('bash', ['-e', scriptPath], {
        cwd: repositoryDirectory,
        encoding: 'utf8',
        env: {
          ...process.env,
          DIRECTORY: join(temporaryDirectory, 'dist'),
          PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ''}`,
          STAMPED_VERSION: stampedVersionPath,
        },
      });

      expect(readFileSync(stampedVersionPath, 'utf8')).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}\.19$/);
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });
});

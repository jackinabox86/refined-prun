import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { firstBufferRuleSize } from '@src/infrastructure/prun-ui/buffer-rule';
import { resolveDispatchAutoSize } from './dispatch-buffer-size';

const here = dirname(fileURLToPath(import.meta.url));
const dispatch = readFileSync(join(here, 'DISPATCH.vue'), 'utf8');
const bufferSizes = readFileSync(
  join(here, '../../../infrastructure/prun-ui/buffer-sizes.ts'),
  'utf8',
);

describe('resolveDispatchAutoSize', () => {
  it('keeps a XIT SET Buffers rule, height included, over the content width', () => {
    expect(resolveDispatchAutoSize([640, 420], 1200, 500)).toEqual([640, 420]);
  });

  it('uses the content width and parsed height when no rule matches', () => {
    expect(resolveDispatchAutoSize(undefined, 1200, 480)).toEqual([1200, 480]);
  });

  it('falls back to 500 height when the body height has not been written', () => {
    expect(resolveDispatchAutoSize(undefined, 1200, Number.NaN)).toEqual([1200, 500]);
  });

  it('wires the rule into the auto-width step', () => {
    const watch = dispatch.slice(dispatch.indexOf('const stopWidthWatch'));
    expect(watch.indexOf('matchUserBufferSize(tile.fullCommand)')).toBeGreaterThan(-1);
    expect(watch.indexOf('matchUserBufferSize(tile.fullCommand)')).toBeLessThan(
      watch.indexOf('setBufferSize(tile.id, width, height)'),
    );
    expect(watch).toContain('resolveDispatchAutoSize(');
    expect(watch).toContain('for (const child of panes.children)');
    const ruleReturn = bufferSizes.indexOf(
      'return firstBufferRuleSize(command, userData.settings.buffers)',
    );
    expect(ruleReturn).toBeGreaterThan(-1);
    expect(ruleReturn).toBeLessThan(bufferSizes.indexOf("commandUpper === 'PLI'"));
  });
});

describe('firstBufferRuleSize', () => {
  it('returns the first matching rule, including height', () => {
    expect(
      firstBufferRuleSize('XIT DISPATCH', [
        ['XIT DISPATCH', 640, 420],
        ['DISPATCH', 100, 100],
      ]),
    ).toEqual([640, 420]);
  });

  it('returns undefined when nothing matches', () => {
    expect(firstBufferRuleSize('XIT DISPATCH', [])).toBeUndefined();
  });
});

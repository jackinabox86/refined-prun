import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'CXPO_BUY.ts'), 'utf8');

describe('CXPO_BUY price-threshold gate', () => {
  it('compares the live buy price to the refined-PrUn value before waitAct', () => {
    expect(source).toContain('resolveCxBuyPrice');
    expect(source).toContain('getPrice(ticker)');
    expect(source).toContain('priceExcessLevel');
    expect(source).toContain('showTileOverlay');
    expect(source).toContain('PriceThresholdWarning');
    expect(source.indexOf('priceExcessLevel')).toBeLessThan(source.indexOf('await waitAct'));
  });

  it('does not force a pause unless the level is past a threshold', () => {
    expect(source).toContain('priceWarningActDelayMs(level)');
    expect(source).toContain('actDelayMs > 0 ? { actDelayMs } : undefined');
    expect(source).not.toMatch(/await waitAct\(\s*undefined,\s*\{\s*actDelayMs:\s*2000/);
  });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'CXPO_BUY.ts'), 'utf8');
// Ordering assertions read the execute body only; against the whole file the import
// block would satisfy them no matter where the call sites ended up.
const executeBody = source.slice(source.indexOf('execute: async ctx'));

describe('CXPO_BUY price-threshold gate', () => {
  it('compares the live buy price to the refined-PrUn value before waitAct', () => {
    expect(source).toContain('resolveCxBuyPrice');
    expect(source).toContain('getPrice(ticker)');
    expect(source).toContain('priceExcessLevel');
    expect(source).toContain('showTileOverlay');
    expect(source).toContain('PriceThresholdWarning');
    expect(executeBody).toContain('priceExcessLevel(');
    expect(executeBody).toContain('showTileOverlay(');
    expect(executeBody).toContain('await waitAct(');
    // The overlay must be dismissed before ACT/SKIP come back, so both the threshold
    // check and the overlay have to run ahead of waitAct.
    expect(executeBody.indexOf('priceExcessLevel(')).toBeLessThan(
      executeBody.indexOf('await waitAct('),
    );
    expect(executeBody.indexOf('showTileOverlay(')).toBeLessThan(
      executeBody.indexOf('await waitAct('),
    );
  });

  it('makes the overlay dismissable only from the warning itself', () => {
    // A backdrop click lands wherever the player was already clicking - i.e. on ACT -
    // so the warning would be gone before it was read.
    const overlayCall = executeBody.slice(executeBody.indexOf('showTileOverlay('));
    expect(overlayCall.slice(0, overlayCall.indexOf('await waitAct('))).toContain(
      'dismissOnBackdrop: false',
    );
  });

  it('does not force a pause after the warning is dismissed', () => {
    // DISMISS is the whole gate: once the player has read the overage they choose
    // ACT or SKIP immediately, so this step must not pass waitAct a delay.
    expect(executeBody).toContain('await waitAct();');
    expect(executeBody).not.toContain('actDelayMs');
  });
});

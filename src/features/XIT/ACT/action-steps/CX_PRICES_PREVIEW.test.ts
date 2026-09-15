import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'CX_PRICES_PREVIEW.ts'), 'utf8');
const executeBody = source.slice(source.indexOf('execute: async ctx'));

describe('CX_PRICES_PREVIEW', () => {
  it('loads missing prices from the unexpanded CX listing before the review pause', () => {
    expect(executeBody).toContain('requestTile(`CX ${exchange}`, { actGate: false })');
    expect(executeBody).toContain('loadMissingCategoryPrices');
    expect(source).toContain('changeSelectIndex');
    expect(executeBody.indexOf('loadMissingCategoryPrices')).toBeLessThan(
      executeBody.indexOf('await waitAct('),
    );
    expect(executeBody.indexOf('log.info(formatPreviewTotal')).toBeLessThan(
      executeBody.indexOf('await waitAct('),
    );
  });

  it('pauses Act for 2s after the log preview; Skip is the step-machine default', () => {
    expect(executeBody).toContain('await waitAct(');
    expect(executeBody).toContain('actDelayMs: 2000');
    expect(executeBody).not.toContain('skip(');
  });

  it('does not open CXPO or submit a buy', () => {
    expect(executeBody).not.toContain('CXPO');
    expect(source).not.toContain('clickElement');
    expect(executeBody).not.toContain('C.Button.success');
  });
});

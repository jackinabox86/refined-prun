import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'CX_PRICES_PREVIEW.ts'), 'utf8');
const executeBody = source.slice(source.indexOf('execute: async ctx'));
// Sliced so ordering assertions inside the loader can't be satisfied by a match in
// execute() or in the import block.
const loaderBody = source.slice(
  source.indexOf('async function loadMissingCategoryPrices'),
  source.indexOf('function categoryLabel'),
);

describe('CX_PRICES_PREVIEW', () => {
  it('loads missing prices from the unexpanded CX listing before the review pause', () => {
    expect(executeBody).toContain('requestTile(`CX ${exchange}`, { actGate: false })');
    expect(executeBody).toContain('loadMissingCategoryPrices');
    expect(source).toContain('changeSelectIndex');
    expect(executeBody.indexOf('loadMissingCategoryPrices')).toBeLessThan(
      executeBody.indexOf('await waitAct('),
    );
  });

  it('gates every category page on a player click instead of paging the listing itself', () => {
    expect(loaderBody).toContain('await waitAct(');
    expect(loaderBody.indexOf('await waitAct(')).toBeLessThan(
      loaderBody.indexOf('changeSelectIndex(select, index)'),
    );
    // A delay would gray ACT between pages; the player clicks through at their own speed.
    expect(loaderBody).not.toContain('actDelayMs');
  });

  it('shows the preview in the companion pane, not the log', () => {
    expect(executeBody).toContain('showTileOverlay(');
    expect(executeBody).toContain('PricesPreview');
    expect(executeBody.indexOf('showTileOverlay(')).toBeLessThan(
      executeBody.indexOf('await waitAct('),
    );
    // The only log.info of the preview is the fallback for a pane with no overlay host.
    expect(executeBody.indexOf('closePreview === undefined')).toBeLessThan(
      executeBody.indexOf('log.info(total)'),
    );
  });

  it('pauses Act for 2s after the preview; Skip is the step-machine default', () => {
    expect(executeBody).toContain('await waitAct(');
    expect(executeBody).toContain('actDelayMs: 2000');
    expect(executeBody).not.toContain('skip(');
  });

  it('does not open CXPO or submit a buy', () => {
    expect(executeBody).not.toContain('CXPO');
    expect(source).not.toContain('clickElement');
    expect(executeBody).not.toContain('C.Button.success');
  });

  it('shades with the NOBUY thresholds, not local defaults', () => {
    expect(executeBody).toContain('userData.settings.noBuyThresholds');
    expect(executeBody).toContain('thresholds?.yellow ?? 10');
    expect(executeBody).toContain('thresholds?.red ?? 20');
    expect(source).not.toContain('DEFAULT_YELLOW_PERCENT');
  });
});

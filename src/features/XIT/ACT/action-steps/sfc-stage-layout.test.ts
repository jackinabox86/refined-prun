import { describe, expect, it } from 'vitest';
import {
  ACT_SFC_PANE_WIDTH,
  SFC_PANE_MIN_WIDTH,
  SFC_STAGE_MIN_HEIGHT,
  sfcStageWindowSize,
} from './sfc-stage-layout';

describe('sfcStageWindowSize', () => {
  it('grows a small window to the SFC-stage minimums and keeps ACT narrower than SFC', () => {
    const layout = sfcStageWindowSize(450, 300);
    expect(layout.width).toBe(ACT_SFC_PANE_WIDTH + SFC_PANE_MIN_WIDTH);
    expect(layout.height).toBe(SFC_STAGE_MIN_HEIGHT);
    expect(layout.actWidth).toBe(ACT_SFC_PANE_WIDTH);
    expect(layout.sfcWidth).toBe(SFC_PANE_MIN_WIDTH);
    expect(layout.actWidth).toBeLessThan(layout.sfcWidth);
    expect(layout.actWidth + layout.sfcWidth).toBe(layout.width);
  });

  it('does not shrink a larger player-sized window', () => {
    const layout = sfcStageWindowSize(1200, 700);
    expect(layout.width).toBe(1200);
    expect(layout.height).toBe(700);
    expect(layout.actWidth).toBe(ACT_SFC_PANE_WIDTH);
    expect(layout.sfcWidth).toBe(1200 - ACT_SFC_PANE_WIDTH);
  });

  it('treats NaN measurements as zero', () => {
    const layout = sfcStageWindowSize(Number.NaN, Number.NaN);
    expect(layout.width).toBe(ACT_SFC_PANE_WIDTH + SFC_PANE_MIN_WIDTH);
    expect(layout.height).toBe(SFC_STAGE_MIN_HEIGHT);
  });
});

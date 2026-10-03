import { describe, expect, it } from 'vitest';
import { RT_STAGE_MIN_HEIGHT, rtStageWindowSize } from './rt-stage-layout';

describe('rtStageWindowSize', () => {
  // Owner asked for RTEXEC about 35% narrower than the 1440px it opened at.
  it('gives the log pane less width than the route pane, about 35% under 1440px', () => {
    const layout = rtStageWindowSize(550);
    expect(layout.actWidth).toBeLessThan(layout.rtWidth);
    expect(layout.actWidth + layout.rtWidth).toBeLessThanOrEqual(Math.round(1440 * 0.65) + 5);
  });

  it('grows the height to the minimum but never shrinks it', () => {
    expect(rtStageWindowSize(550).height).toBe(RT_STAGE_MIN_HEIGHT);
    expect(rtStageWindowSize(900).height).toBe(900);
    expect(rtStageWindowSize(NaN).height).toBe(RT_STAGE_MIN_HEIGHT);
  });
});

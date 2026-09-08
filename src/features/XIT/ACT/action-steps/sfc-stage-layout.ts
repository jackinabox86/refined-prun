// First-SFC window: ACT pane stays narrow, SFC gets the rest.
// Grow-only so a larger player-sized window is not shrunk.
export const ACT_SFC_PANE_WIDTH = 320;
export const SFC_PANE_MIN_WIDTH = 520;
export const SFC_STAGE_MIN_HEIGHT = 480;

export function sfcStageWindowSize(currentWidth: number, currentHeight: number) {
  const width = Math.max(finiteOrZero(currentWidth), ACT_SFC_PANE_WIDTH + SFC_PANE_MIN_WIDTH);
  const height = Math.max(finiteOrZero(currentHeight), SFC_STAGE_MIN_HEIGHT);
  return {
    actWidth: ACT_SFC_PANE_WIDTH,
    sfcWidth: width - ACT_SFC_PANE_WIDTH,
    width,
    height,
  };
}

function finiteOrZero(n: number) {
  return Number.isFinite(n) ? n : 0;
}

// First-SFC window layout. The ACT pane keeps the width it already has and the window
// grows to give SFC its own space, so swapping SFC in on the right does not squeeze the
// left pane. Grow-only: a larger player-sized window is never shrunk.
export const ACT_PANE_MIN_WIDTH = 320;
export const SFC_PANE_MIN_WIDTH = 520;
export const SFC_STAGE_MIN_HEIGHT = 670;

export function sfcStageWindowSize(
  actPaneWidth: number,
  currentWidth: number,
  currentHeight: number,
) {
  const actWidth = Math.max(finiteOrZero(actPaneWidth), ACT_PANE_MIN_WIDTH);
  // Whatever the window has left over for SFC, but never less than SFC needs. The
  // shortfall is what the window grows by, so actWidth survives the stage unchanged.
  const sfcWidth = Math.max(finiteOrZero(currentWidth) - actWidth, SFC_PANE_MIN_WIDTH);
  const height = Math.max(finiteOrZero(currentHeight), SFC_STAGE_MIN_HEIGHT);
  return {
    actWidth,
    sfcWidth,
    width: actWidth + sfcWidth,
    height,
  };
}

function finiteOrZero(n: number) {
  return Number.isFinite(n) ? n : 0;
}

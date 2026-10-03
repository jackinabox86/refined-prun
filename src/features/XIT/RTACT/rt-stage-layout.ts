// RTEXEC window once the RT tile is in. RTEXEC inherits the ROUTECONFIG window (990px)
// and the split adds 450px more, so it opened 1440px wide. The log pane needs far less
// than the route editor, so the panes are sized unequally like the SFC stage.
export const RT_ACT_PANE_WIDTH = 400;
export const RT_PANE_WIDTH = 540;
export const RT_STAGE_MIN_HEIGHT = 670;

export function rtStageWindowSize(currentHeight: number) {
  const height = Math.max(Number.isFinite(currentHeight) ? currentHeight : 0, RT_STAGE_MIN_HEIGHT);
  return { actWidth: RT_ACT_PANE_WIDTH, rtWidth: RT_PANE_WIDTH, height };
}

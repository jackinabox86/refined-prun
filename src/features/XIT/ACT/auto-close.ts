let enabled = false;

export function setActDispatchAutoCloseEnabled(value: boolean) {
  enabled = value;
}

// Every host that can close is a host that mounts ExecuteActionPackage — XIT ACT/ACTION,
// DISPATCHACT, BURNACT, REPAIRACT, REFUELACT, GOVBURNEXEC, GOVBURNDATA and XIT AGENT — so
// the decision needs no command allowlist. The planners (XIT DISPATCH, XIT GOVBURNACT)
// stage a package and never reach package completion, so they are unaffected. A run whose
// buffer still holds output the player needs passes keepBufferOpen.
export function shouldAutoCloseActBuffer(completedSuccessfully: boolean, keepBufferOpen = false) {
  if (!enabled || !completedSuccessfully || keepBufferOpen) {
    return false;
  }
  return true;
}

const AUTO_CLOSE_COMMANDS = new Set(['ACT', 'ACTION', 'DISPATCHACT']);

let enabled = false;

export function setActDispatchAutoCloseEnabled(value: boolean) {
  enabled = value;
}

export function shouldAutoCloseActBuffer(command: string, completedSuccessfully: boolean) {
  if (!enabled || !completedSuccessfully) {
    return false;
  }
  return AUTO_CLOSE_COMMANDS.has(command.toUpperCase());
}

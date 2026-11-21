export function sfcCompanionCommand(
  event: { shiftKey: boolean },
  cmdText: string | null | undefined,
  registration: string | undefined,
): string | undefined {
  if (!event.shiftKey) {
    return undefined;
  }
  if (registration === undefined || registration === '') {
    return undefined;
  }
  const cmd = cmdText?.trim().toUpperCase();
  if (cmd !== 'SFC' && cmd?.startsWith('SFC ') !== true) {
    return undefined;
  }
  return `SFC ${registration}`;
}

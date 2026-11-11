// The RT runner drives the game's route editor, so it runs only on the APEX game hosts.
export const PRODUCTION_HOST = 'apex.prosperousuniverse.com';
export const STAGING_HOST = 'apex.staging.prosperousuniverse.com';

export function isRtHost(hostname: string): boolean {
  return hostname === PRODUCTION_HOST || hostname === STAGING_HOST;
}

// A string means "do not start". Undefined means the host is an APEX game host.
export function rtRunBlock(hostname: string): string | undefined {
  if (isRtHost(hostname)) {
    return undefined;
  }
  return `RT route runner only runs on ${PRODUCTION_HOST}`;
}

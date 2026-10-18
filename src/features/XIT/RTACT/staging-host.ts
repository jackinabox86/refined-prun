// The runner is a no-op everywhere except the staging game host.
export const STAGING_HOST = 'apex.staging.prosperousuniverse.com';

export function isStagingHost(hostname: string): boolean {
  return hostname === STAGING_HOST;
}

// A string means "do not start". Undefined means the host is staging.
export function stagingRunBlock(hostname: string): string | undefined {
  if (isStagingHost(hostname)) {
    return undefined;
  }
  return `RT route runner is inert off ${STAGING_HOST}`;
}

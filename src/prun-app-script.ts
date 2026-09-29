const PRODUCTION_HOST = 'apex.prosperousuniverse.com';
const STAGING_HOST = 'apex.staging.prosperousuniverse.com';

// Staging script URLs do not contain the production host: "apex.staging…" is not
// a substring match for "apex.prosperousuniverse.com".
export function isStagingPrunAppScript(src: string): boolean {
  return src.includes(STAGING_HOST);
}

export function isPrunAppScript(src: string, devBuild: boolean): boolean {
  if (src.includes(PRODUCTION_HOST)) {
    return true;
  }
  if (!devBuild) {
    return false;
  }
  return isStagingPrunAppScript(src);
}

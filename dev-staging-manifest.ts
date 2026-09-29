const PRODUCTION_ORIGIN = 'https://apex.prosperousuniverse.com/';
const PRODUCTION_MATCH = 'https://apex.prosperousuniverse.com/*';
const STAGING_ORIGIN = 'https://apex.staging.prosperousuniverse.com/';
const STAGING_MATCH = 'https://apex.staging.prosperousuniverse.com/*';

type MatchEntry = { matches?: string[] } & Record<string, unknown>;

export interface ExtensionManifest {
  host_permissions?: string[];
  content_scripts?: MatchEntry[];
  web_accessible_resources?: MatchEntry[];
  [key: string]: unknown;
}

// Dev builds may run on APEX staging. Store builds keep the checked-in manifest.
export function manifestForBuild(
  manifest: ExtensionManifest,
  devBuild: boolean,
): ExtensionManifest {
  if (!devBuild) {
    return manifest;
  }
  return {
    ...manifest,
    host_permissions: mirrorPattern(manifest.host_permissions, PRODUCTION_ORIGIN, STAGING_ORIGIN),
    content_scripts: mirrorMatchEntries(manifest.content_scripts, PRODUCTION_MATCH, STAGING_MATCH),
    web_accessible_resources: mirrorMatchEntries(
      manifest.web_accessible_resources,
      PRODUCTION_MATCH,
      STAGING_MATCH,
    ),
  };
}

function mirrorMatchEntries(
  entries: MatchEntry[] | undefined,
  production: string,
  staging: string,
): MatchEntry[] | undefined {
  if (entries === undefined) {
    return undefined;
  }
  return entries.map(entry => {
    const matches = mirrorPattern(entry.matches, production, staging);
    if (matches === entry.matches) {
      return entry;
    }
    return { ...entry, matches };
  });
}

function mirrorPattern(
  patterns: string[] | undefined,
  production: string,
  staging: string,
): string[] | undefined {
  if (patterns === undefined) {
    return undefined;
  }
  if (!patterns.includes(production)) {
    return patterns;
  }
  if (patterns.includes(staging)) {
    return patterns;
  }
  return [...patterns, staging];
}

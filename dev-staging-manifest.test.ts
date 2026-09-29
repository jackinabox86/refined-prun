import { describe, expect, it } from 'vitest';
import storeManifest from './public/manifest.json';
import { manifestForBuild, type ExtensionManifest } from './dev-staging-manifest';

const STAGING_ORIGIN = 'https://apex.staging.prosperousuniverse.com/';
const STAGING_MATCH = 'https://apex.staging.prosperousuniverse.com/*';

function asManifest(value: unknown): ExtensionManifest {
  return value as ExtensionManifest;
}

describe('manifestForBuild', () => {
  it('adds the staging host only to the lists that already match production', () => {
    const dev = manifestForBuild(asManifest(storeManifest), true);

    expect(dev.host_permissions).toEqual(['https://apex.prosperousuniverse.com/', STAGING_ORIGIN]);
    expect(dev.content_scripts?.[0]?.matches).toEqual([
      'https://apex.prosperousuniverse.com/*',
      STAGING_MATCH,
    ]);
    expect(dev.web_accessible_resources?.[0]?.matches).toEqual([
      'https://apex.prosperousuniverse.com/*',
      STAGING_MATCH,
    ]);
    expect(dev.name).toBe(storeManifest.name);
    expect(dev.content_scripts?.[0]?.js).toEqual(storeManifest.content_scripts[0].js);
  });

  it('does not add the staging host to a production build', () => {
    const prod = manifestForBuild(asManifest(storeManifest), false);

    expect(prod).toBe(storeManifest);
    expect(JSON.stringify(prod)).not.toContain('apex.staging.prosperousuniverse.com');
  });

  it('does not duplicate the staging host when applied twice', () => {
    const once = manifestForBuild(asManifest(storeManifest), true);
    const twice = manifestForBuild(once, true);

    expect(twice.host_permissions).toEqual(once.host_permissions);
    expect(twice.content_scripts?.[0]?.matches).toEqual(once.content_scripts?.[0]?.matches);
  });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STAGING_HOST } from './staging-host';
import { buildStagingPackage } from './staging-package';

describe('buildStagingPackage', () => {
  const spec = 'ZV-307d\nANT\n';

  it('does not build a package off the staging host', () => {
    const result = buildStagingPackage('apex.prosperousuniverse.com', '', spec);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result).not.toHaveProperty('pkg');
  });

  it('builds a package on the staging host', () => {
    const result = buildStagingPackage(STAGING_HOST, '', spec);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.pkg.actions[0].type).toBe('Staging RT');
    expect(result.pkg.actions[0].routeSpec).toBe(spec);
  });
});

const here = dirname(fileURLToPath(import.meta.url));

describe('RT_BUILD source order', () => {
  const source = readFileSync(join(here, 'RT_BUILD.ts'), 'utf8');
  const execute = source.slice(source.indexOf('execute: async ctx'));

  it('blocks on the staging host before it requests a tile', () => {
    expect(execute.indexOf('stagingRunBlock')).toBeGreaterThan(-1);
    expect(execute.indexOf('stagingRunBlock')).toBeLessThan(execute.indexOf('requestTile('));
  });

  it('checks the add-waypoint gate before clicking ADD WAYPOINT', () => {
    const gate = execute.indexOf('shouldClickAddWaypoint');
    const click = execute.indexOf("clickControl(tile.anchor, 'ADD WAYPOINT'");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(click);
  });

  it('does not name a delete or SAVE click', () => {
    expect(execute).not.toMatch(/clickControl\([^)]*delete/i);
    expect(execute).not.toMatch(/clickControl\([^)]*SAVE/);
  });
});

describe('route-dom click path', () => {
  const source = readFileSync(join(here, 'route-dom.ts'), 'utf8');
  const clickControl = source.slice(source.indexOf('export async function clickControl'));

  it('selects the control before clicking it', () => {
    expect(clickControl.indexOf('selectControlLabel')).toBeLessThan(
      clickControl.indexOf('clickElement'),
    );
  });
});

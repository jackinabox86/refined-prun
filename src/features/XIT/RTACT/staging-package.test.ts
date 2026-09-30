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
  const modeWord = source.slice(source.indexOf('async function clickModeWord'));

  it('selects the control before clicking it', () => {
    expect(clickControl.indexOf('selectControlLabel')).toBeLessThan(
      clickControl.indexOf('clickElement'),
    );
  });

  it('refuses SAVE before a mode-word click', () => {
    expect(modeWord.indexOf('assertEditorClick')).toBeGreaterThan(-1);
    expect(modeWord.indexOf('assertEditorClick')).toBeLessThan(modeWord.indexOf('clickElement'));
  });
});

describe('addStep re-resolves and cancels the editor poll', () => {
  const source = readFileSync(join(here, 'RT_BUILD.ts'), 'utf8');
  const addStep = source.slice(
    source.indexOf('async function addStep'),
    source.indexOf('function findLabeled'),
  );

  it('looks up the waypoint again inside the step instead of taking a cached element', () => {
    expect(addStep).toContain('findWaypointScope');
    expect(addStep).toContain('waypointBlock');
    expect(addStep).not.toContain('scope: Element');
  });

  it('clears the disconnect poll after the SAVE wait', () => {
    expect(addStep.indexOf('waitSkipOr')).toBeGreaterThan(-1);
    expect(addStep.indexOf('waitSkipOr')).toBeLessThan(addStep.indexOf('cancel()'));
  });

  it('waits for the step pencil after the add feedback', () => {
    const afterFeedback = addStep.slice(addStep.lastIndexOf('await waitActionFeedback(tile);'));
    const lookup = afterFeedback.indexOf('findStepEdit');
    expect(lookup).toBeGreaterThan(-1);
    expect(afterFeedback.indexOf('waitFor')).toBeLessThan(lookup);
  });
});

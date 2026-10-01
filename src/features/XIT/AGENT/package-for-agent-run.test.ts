import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { shouldEmitAutoSfc } from '@src/features/XIT/ACT/actions/mtra/auto-sfc';
import { packageForAgentRun } from './package-for-agent-run';

const posted: UserData.ActionPackageData = {
  global: { name: 'Auto Offload' },
  groups: [],
  actions: [
    {
      type: 'MTRA',
      name: 'Auto Offload',
      group: 'Auto Offload',
      origin: 'BUFFER 33 Cargo',
      dest: 'Promitor Base',
    },
    {
      type: 'MTRA',
      name: 'Pickup Promitor',
      group: 'Pickup Promitor',
      origin: 'Promitor Base',
      dest: 'BUFFER 33 Cargo',
    },
    {
      type: 'CX Buy',
      name: 'Buy',
      group: 'Buy',
    },
  ],
};

// Runner appends host extra steps after package generation. The host tail is
// the completion marker, then non-input loads, then one OPEN_SFC.
function simulatedAgentRun(pkg: UserData.ActionPackageData, hostOwnsDeparture: boolean) {
  const prepared = packageForAgentRun(pkg, hostOwnsDeparture);
  const steps: Array<'TRANSFER' | 'OPEN_SFC' | 'AGENT_DONE' | 'LOAD'> = [];
  for (const action of prepared.actions) {
    if (action.type !== 'MTRA') {
      continue;
    }
    steps.push('TRANSFER');
    if (shouldEmitAutoSfc(action, undefined, prepared.global.name)) {
      steps.push('OPEN_SFC');
    }
  }
  if (hostOwnsDeparture) {
    steps.push('AGENT_DONE', 'LOAD', 'OPEN_SFC');
  }
  return { prepared, steps };
}

describe('packageForAgentRun', () => {
  it('runs the non-input load before the only departure', () => {
    const { prepared, steps } = simulatedAgentRun(posted, true);
    const loadAt = steps.indexOf('LOAD');
    const departures = steps.flatMap((step, index) => (step === 'OPEN_SFC' ? [index] : []));
    expect(loadAt).toBeGreaterThan(-1);
    expect(departures).toEqual([loadAt + 1]);
    expect(prepared.actions.filter(x => x.type === 'MTRA').every(x => x.noSfc === true)).toBe(true);
    expect(prepared.actions.find(x => x.type === 'CX Buy')?.noSfc).toBeUndefined();
  });

  it('does not mutate the stored package', () => {
    const { prepared } = simulatedAgentRun(posted, true);
    expect(prepared).not.toBe(posted);
    expect(posted.actions[1]?.noSfc).toBeUndefined();
    expect(shouldEmitAutoSfc(posted.actions[1]!, undefined, posted.global.name)).toBe(true);
  });

  it('leaves package auto-SFC in place when the host will not depart', () => {
    const { prepared, steps } = simulatedAgentRun(posted, false);
    expect(prepared).toBe(posted);
    expect(steps.filter(x => x === 'OPEN_SFC').length).toBeGreaterThan(0);
    expect(steps).not.toContain('LOAD');
  });

  it('appends the host OPEN_SFC after the non-input loads', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'ExecuteStoredPackage.vue'),
      'utf8',
    );
    const load = source.indexOf('steps.push(...buildLoadSteps');
    const depart = source.indexOf('steps.push(OPEN_SFC');
    expect(load).toBeGreaterThan(-1);
    expect(depart).toBeGreaterThan(load);
    expect(source).toContain('packageForAgentRun');
  });
});

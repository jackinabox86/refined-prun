import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function productSource(name: string) {
  return readFileSync(join(here, name), 'utf8');
}

describe('BURNACT fit-to-ship size wiring', () => {
  it('filters the catalog through live fleet holds', () => {
    const source = productSource('Configure.vue');
    expect(source).toContain('shipSizesOwnedByFleet');
    expect(source).toContain('shipsStore.all.value');
    expect(source).toContain('storagesStore.getById');
    expect(source).toContain('v-for="ship in ownedShipSizes"');
    expect(source).not.toMatch(/v-for="ship in shipSizes"/);
  });

  it('does not change fit resolution', () => {
    const configure = productSource('Configure.vue');
    const fitDays = productSource('fit-days.ts');
    expect(configure).toContain('config.days = maxFittingDays');
    expect(fitDays).toContain('export function maxFittingDays');
  });
});

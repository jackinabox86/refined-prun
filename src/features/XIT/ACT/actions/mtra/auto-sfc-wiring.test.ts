import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function productSource(name: string) {
  return readFileSync(join(here, name), 'utf8');
}

describe('auto SFC wiring', () => {
  it('gates the MTRA config toggle through shouldShowAutoSfcToggle', () => {
    const source = productSource('Configure.vue');
    expect(source).toContain('shouldShowAutoSfcToggle');
    expect(source).toContain('label="Auto SFC"');
    expect(source).not.toMatch(/DISPATCHACT/);
  });

  it('does not include DISPATCHACT in the toggle command set', () => {
    const source = productSource('auto-sfc.ts');
    expect(source).toContain("'BURNACT'");
    expect(source).toContain("'REPAIRACT'");
    expect(source).toContain("'GOVBURNEXEC'");
    expect(source).not.toMatch(/DISPATCHACT/);
  });

  it('emits OPEN_SFC only through shouldEmitAutoSfc', () => {
    const source = productSource('mtra.ts');
    expect(source).toContain('shouldEmitAutoSfc(data, config, packageName)');
    expect(source).not.toMatch(/const needsSfc = !data\.noSfc/);
  });

  it('gates DISPATCHACT submit-wait through shouldWaitForSfcSubmit', () => {
    const source = productSource('mtra.ts');
    expect(source).toContain('waitForSubmit: shouldWaitForSfcSubmit(data)');
    expect(source).not.toMatch(/waitForSubmit:\s*true/);
  });
});

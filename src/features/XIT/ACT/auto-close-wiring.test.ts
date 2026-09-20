import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function productSource(name: string) {
  return readFileSync(join(here, name), 'utf8');
}

describe('ACT auto-close wiring', () => {
  it('calls onComplete only after the success stop in StepMachine', () => {
    const source = productSource('runner/step-machine.ts');
    expect(source).toContain("this.log.success('Action Package execution completed')");
    expect(source).toContain('this.options.onComplete?.()');
    expect(source.match(/onComplete\?\.\(\)/g)?.length).toBe(1);
    const cancelFn = source.match(/cancel\(\) \{[\s\S]*?\n {2}\}/)?.[0];
    expect(cancelFn).toBeDefined();
    expect(cancelFn).not.toContain('onComplete');
  });

  it('does not import BURNACT-style hosts into the auto-close command set', () => {
    const source = productSource('auto-close.ts');
    expect(source).not.toMatch(/BURNACT|REFUELACT|REPAIRACT|GOVBURNEXEC/);
    expect(source).toContain("'DISPATCHACT'");
    expect(source).not.toMatch(/'DISPATCH'/);
  });

  it('does not arm ACT during waitSkipOr', () => {
    const source = productSource('runner/step-machine.ts');
    const waitSkipOr = source.match(/private async waitSkipOr[\s\S]*?\n {2}\}/)?.[0];
    expect(waitSkipOr).toBeDefined();
    expect(waitSkipOr).toContain('onSkipReady()');
    expect(waitSkipOr).not.toContain('onActReady');
  });

  it('closes from ExecuteActionPackage only through shouldAutoCloseActBuffer', () => {
    const source = productSource('ExecuteActionPackage.vue');
    expect(source).toContain('shouldAutoCloseActBuffer(command, true)');
    expect(source).toContain('closePrunWindow(tile.window)');
    expect(source).not.toContain('closeTileWindow');
    expect(source).toContain('onComplete:');
  });
});

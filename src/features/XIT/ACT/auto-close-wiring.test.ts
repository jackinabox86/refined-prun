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
    expect(source).toContain('this.options.onComplete?.({ keepBufferOpen: this.keepBufferOpen })');
    expect(source.match(/onComplete\?\.\(/g)?.length).toBe(1);
    const cancelFn = source.match(/cancel\(\) \{[\s\S]*?\n {2}\}/)?.[0];
    expect(cancelFn).toBeDefined();
    expect(cancelFn).not.toContain('onComplete');
  });

  it('decides on completion alone, with no per-command allowlist', () => {
    const source = productSource('auto-close.ts');
    const decide = source.match(/export function shouldAutoCloseActBuffer[\s\S]*$/)?.[0];
    expect(decide).toBeDefined();
    expect(decide).not.toMatch(/BURNACT|REPAIRACT|REFUELACT|GOVBURNEXEC|DISPATCHACT|'ACT'/);
    expect(decide).not.toMatch(/\bcommand\b/);
  });

  it('keeps the buffer open for a printed JSON payload or a skipped SFC', () => {
    const source = productSource('runner/step-machine.ts');
    expect(source).toContain("this.keepBufferOpen = steps.some(x => x.type === 'LOG_JSON')");
    const skipFn = source.match(/ {2}skip\(opts\?[\s\S]*?\n {2}\}/)?.[0];
    expect(skipFn).toBeDefined();
    expect(skipFn).toContain("next.type === 'OPEN_SFC'");
    expect(skipFn).toContain('this.keepBufferOpen = true');
  });

  it('lets BURNACT keep its buffer open when it printed the return JSON', () => {
    const source = productSource('../BURN/BurnActWindow.vue');
    expect(source).toContain(':keep-open-on-complete="keepOpenOnComplete"');
    expect(source).toContain('return generateReturnJson.value');
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
    expect(source).toContain('shouldAutoCloseActBuffer(true, keepOpen)');
    expect(source).toContain('closePrunWindow(tile.window)');
    expect(source).not.toContain('closeTileWindow');
    expect(source).toContain('onComplete: result =>');
  });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function productSource(name: string) {
  return readFileSync(join(here, name), 'utf8');
}

describe('OPEN_SFC host window size', () => {
  it('does not write Window.body style or the old 975x750 hardcode', () => {
    const source = productSource('OPEN_SFC.ts');
    expect(source).not.toMatch(/bodyEl\.style\.(width|height)\s*=/);
    expect(source).not.toContain('975px');
    expect(source).not.toContain('750px');
  });

  it('applies the SFC-stage layout once through game messages', () => {
    const source = productSource('OPEN_SFC.ts');
    expect(source).toContain('if (isFirstOfType)');
    expect(source).toContain('applySfcStageLayout(tile)');
    expect(source).toContain('resizeSplitWindow');
    expect(source).toContain('splitOwnerId');
    expect(source).toContain('sfcStageWindowSize');
    expect(source.match(/if \(isFirstOfType\)/g)?.length).toBe(1);
  });
});

describe('OPEN_SFC DISPATCHACT submit gate', () => {
  it('waits for fleet-status change only when waitForSubmit is set', () => {
    const source = productSource('OPEN_SFC.ts');
    expect(source).toContain('if (data.waitForSubmit && !hasShipStartedFlight');
    expect(source).toContain('waitSkipOr');
    expect(source).toContain('SFC_SUBMIT_STATUS');
    expect(source.match(/waitSkipOr/g)?.length).toBe(2);
  });

  it('does not wait for submit on the default complete path', () => {
    const source = productSource('OPEN_SFC.ts');
    expect(source).toContain('complete();');
    expect(source).not.toMatch(/await waitSkipOr\([^;]+\);\s*complete\(\)/);
  });
});

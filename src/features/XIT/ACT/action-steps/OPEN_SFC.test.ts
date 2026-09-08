import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

function productSource(name: string) {
  return readFileSync(join(here, name), 'utf8');
}

describe('OPEN_SFC host window size', () => {
  it('does not force Window.body dimensions on the SFC stage', () => {
    const source = productSource('OPEN_SFC.ts');
    expect(source).not.toMatch(/bodyEl\.style\.(width|height)/);
    expect(source).not.toContain('975px');
    expect(source).not.toContain('750px');
    expect(source).not.toContain('setBufferSize');
    expect(source).not.toContain('UI_WINDOWS_UPDATE_SIZE');
  });
});

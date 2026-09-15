import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'cx-buy.ts'), 'utf8');

describe('CX Buy prices preview emission', () => {
  it('emits CX_PRICES_PREVIEW before CXPO_BUY when the setting is on', () => {
    expect(source).toContain(
      'shouldEmitPricesPreview(userData.settings.cxPricesPreview, buys.length)',
    );
    expect(source).toContain('CX_PRICES_PREVIEW');
    expect(source.indexOf('CX_PRICES_PREVIEW(')).toBeLessThan(source.indexOf('CXPO_BUY({'));
  });
});

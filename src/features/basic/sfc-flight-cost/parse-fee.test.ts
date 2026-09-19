import { describe, expect, it } from 'vitest';
import { parseFee } from './parse-fee';

// The game prints the fee cell with the client locale's separators. Intl reports U+202F as
// the group separator for fr-FR and U+00A0 for ru/pl/sv/cs, but the markup may carry a plain
// space instead, so every space-grouping locale is probed with all three.
const narrowNbsp = '\u202F';
const nbsp = '\u00A0';

describe('parseFee', () => {
  it('returns 0 for missing or empty text', () => {
    expect(parseFee(null, 'en-US')).toBe(0);
    expect(parseFee(undefined, 'en-US')).toBe(0);
    expect(parseFee('', 'en-US')).toBe(0);
  });

  it('returns 0 when no amount is present', () => {
    expect(parseFee('Fees', 'fr-FR')).toBe(0);
    expect(parseFee(`${nbsp}AIC`, 'ru-RU')).toBe(0);
  });

  it('parses dot-decimal locales', () => {
    expect(parseFee('1,234.56 AIC', 'en-US')).toBeCloseTo(1234.56);
    expect(parseFee('1,234.56 AIC', undefined)).toBeCloseTo(1234.56);
  });

  it('parses comma-decimal locales', () => {
    expect(parseFee('21,43 AIC', 'de-DE')).toBeCloseTo(21.43);
    expect(parseFee('12.345,6 AIC', 'de-DE')).toBeCloseTo(12345.6);
  });

  it('parses space-grouped locales whatever space the markup uses', () => {
    for (const locale of ['fr-FR', 'ru-RU', 'pl-PL', 'sv-SE', 'cs-CZ']) {
      for (const space of [' ', nbsp, narrowNbsp]) {
        expect(parseFee(`12${space}345,6 AIC`, locale)).toBeCloseTo(12345.6);
      }
    }
  });

  it('parses apostrophe-grouped de-CH', () => {
    expect(parseFee("12'345.6 AIC", 'de-CH')).toBeCloseTo(12345.6);
  });

  it('sums concatenated amounts', () => {
    expect(parseFee('12,000 AIC4,000 CIS', 'en-US')).toBe(16000);
    expect(parseFee('12.000 AIC4.000 CIS', 'de-DE')).toBe(16000);
    expect(parseFee(`12${nbsp}000 AIC4${nbsp}000 CIS`, 'ru-RU')).toBe(16000);
  });

  it('ignores an uppercase word following the amount', () => {
    expect(parseFee(`8${nbsp}755 AIC SEGMENTS`, 'ru-RU')).toBe(8755);
  });
});

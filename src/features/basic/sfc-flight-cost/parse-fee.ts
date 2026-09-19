// The fee cell is rendered by the game in the client's locale, so both separators vary:
// "12,345.6 AIC" (en), "12.345,6 AIC" (de), "12 345,6 AIC" (fr/ru/pl/sv/cs),
// "12'345.6 AIC" (de-CH). Derive them from Intl for the active locale and admit them into
// the digit class, otherwise a grouped amount is truncated to its last group and the fee
// is silently undercounted.
export function parseFee(text: string | null | undefined, locale: string | undefined) {
  if (text === null || text === undefined || text === '') {
    return 0;
  }

  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find(x => x.type === 'group')?.value;
  const decimal = parts.find(x => x.type === 'decimal')?.value ?? '.';

  // Intl and the game's own markup do not always agree on which space character a
  // space-grouping locale uses (U+0020, U+00A0 and U+202F are all in play), so match and
  // strip them as one class rather than as the single codepoint Intl happens to report.
  const groupIsSpace = group !== undefined && /\s/.test(group);
  const groupClass = groupIsSpace ? '\\s' : escapeCharClass(group);

  // Amounts can be concatenated without spacing ("12,000 AIC4,000 CIS"), so a \b after
  // the currency code would fail — use a lookahead for "not another letter" instead.
  const pattern = new RegExp(
    String.raw`([\d.,${groupClass}${escapeCharClass(decimal)}]+)\s*[A-Z]{3}(?![A-Z])`,
    'g',
  );

  let fee = 0;
  for (const match of text.matchAll(pattern)) {
    let raw = match[1];
    // A separator-only run can match the digit class, and Number('') is 0, not NaN.
    if (!/\d/.test(raw)) {
      continue;
    }
    if (groupIsSpace) {
      raw = raw.replace(/\s/g, '');
    } else if (group !== undefined) {
      raw = raw.replaceAll(group, '');
    }
    if (decimal !== '.') {
      raw = raw.replaceAll(decimal, '.');
    }
    const value = Number(raw);
    if (!isFinite(value)) {
      continue;
    }
    fee += value;
  }
  return fee;
}

// Inside a character class only these four codepoints carry meaning.
function escapeCharClass(value: string | undefined) {
  return value === undefined ? '' : value.replace(/[\\\]^-]/g, '\\$&');
}

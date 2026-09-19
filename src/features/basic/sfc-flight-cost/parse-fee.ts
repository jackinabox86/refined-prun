// Intl's codepoint and the game's markup do not always agree on which space or apostrophe a
// grouping locale uses, and the answer also moves between ICU versions — de-CH reports
// U+0027 on one Node build and U+2019 on another. Match and strip each family as a set
// rather than trusting the single codepoint Intl happens to report.
const spaceSeparators = [' ', '\u00A0', '\u202F', '\u2009'];
const apostropheSeparators = ["'", '\u2019', '\u02BC'];

function groupSeparators(group: string | undefined) {
  if (group === undefined) {
    return [];
  }
  if (spaceSeparators.includes(group) || /\s/.test(group)) {
    return [...new Set([...spaceSeparators, group])];
  }
  if (apostropheSeparators.includes(group)) {
    return apostropheSeparators;
  }
  return [group];
}

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
  const decimal = parts.find(x => x.type === 'decimal')?.value ?? '.';
  const groups = groupSeparators(parts.find(x => x.type === 'group')?.value);
  const groupClass = groups.map(escapeCharClass).join('');

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
    for (const group of groups) {
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
function escapeCharClass(value: string) {
  return value.replace(/[\\\]^-]/g, '\\$&');
}

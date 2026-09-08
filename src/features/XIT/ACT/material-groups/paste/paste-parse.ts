// Pure parser for the Paste material group. Kept free of store and component
// imports so it can be unit tested; callers inject the ticker lookup.

export type Delimiter = '\t' | ';' | ',';

export const delimiterNames: Record<Delimiter, string> = {
  '\t': 'tab-separated',
  ';': 'semicolon-separated',
  ',': 'comma-separated',
};

// CXPO rounds an order price to this many significant figures, so a limit with
// more of them is not the limit the game would place.
export const maxPriceSignificantFigures = 3;

export interface ParsedRow {
  ticker: string;
  amount: number;
  price?: number;
}

export interface ParseError {
  line: number;
  reason: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  delimiter?: Delimiter;
  // Set when the paste cannot be read at all. Suppresses per-line errors.
  fatal?: string;
}

// Resolves a pasted ticker to its canonical form, or undefined if unknown.
export type ResolveTicker = (ticker: string) => string | undefined;

// The characters of a line that sit outside double-quoted spans. A spreadsheet
// paste quotes any field holding the delimiter ("1,600"), and that comma must
// not be mistaken for a separator.
function unquoted(line: string) {
  let result = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes) {
      result += char;
    }
  }
  return result;
}

// Tab beats semicolon beats comma: a comma-decimal row written with semicolons
// ("RAT;100;45,67") holds both, and only the semicolon separates its fields.
function detectDelimiter(line: string): Delimiter {
  const outside = unquoted(line);
  if (outside.includes('\t')) {
    return '\t';
  }
  if (outside.includes(';')) {
    return ';';
  }
  return ',';
}

function splitFields(line: string, delimiter: Delimiter) {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // A doubled quote inside a quoted field is a literal quote.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields.map(x => x.trim());
}

// Each decimal convention permits the other separator, but only in groups of
// three digits — that is what makes "1.600" a thousand and "1.6" a fraction.
const dotDecimalPattern = /^\+?(?:(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/;
const commaDecimalPattern = /^\+?(?:(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d+)?|,\d+)$/;

function normalizeDecimal(value: string) {
  return value
    .replace(/^\+/, '')
    .replace(/^\./, '0.')
    .replace(/^0+(?=\d)/, '')
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}

interface ParsedNumber {
  value: number;
  normalized: string;
}

// Both readings of the raw text, deduplicated. A value with no separators
// normalizes the same way under either convention and yields one candidate.
function numberCandidates(raw: string) {
  const candidates = new Set<string>();
  if (dotDecimalPattern.test(raw)) {
    candidates.add(normalizeDecimal(raw.replaceAll(',', '')));
  }
  if (commaDecimalPattern.test(raw)) {
    candidates.add(normalizeDecimal(raw.replaceAll('.', '').replace(',', '.')));
  }
  return [...candidates];
}

function toParsedNumber(normalized: string, raw: string): ParsedNumber | { error: string } {
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
    return { error: `"${raw}" is not a finite positive number` };
  }
  return { value, normalized };
}

function parseQuantity(raw: string): { amount: number } | { error: string } {
  const candidates = numberCandidates(raw);
  if (candidates.length === 0) {
    return { error: `"${raw}" is not a supported number` };
  }
  // A quantity is always whole, which settles "1,600" — 1.6 is not a candidate
  // reading of it, so a spreadsheet's grouping separator needs no ceremony.
  const whole = candidates.filter(x => !x.includes('.'));
  if (whole.length !== 1) {
    return { error: `quantity "${raw}" is not a whole number` };
  }
  const parsed = toParsedNumber(whole[0], raw);
  if ('error' in parsed) {
    return parsed;
  }
  if (!Number.isSafeInteger(parsed.value)) {
    return { error: `quantity "${raw}" is not a whole number` };
  }
  return { amount: parsed.value };
}

function parsePrice(raw: string): { price: number } | { error: string } {
  const candidates = numberCandidates(raw);
  if (candidates.length === 0) {
    return { error: `"${raw}" is not a supported number` };
  }
  // A price can be fractional, so grouping cannot be told from a decimal here.
  if (candidates.length > 1) {
    return { error: `price "${raw}" has ambiguous separators; write it without grouping` };
  }
  const parsed = toParsedNumber(candidates[0], raw);
  if ('error' in parsed) {
    return parsed;
  }
  // CXPO_BUY writes the limit through fixed02. Do not accept one it would round.
  if ((parsed.normalized.split('.')[1]?.length ?? 0) > 2) {
    return { error: `price "${raw}" has more than two decimal places` };
  }
  const digits = parsed.normalized.replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  if (digits.length > maxPriceSignificantFigures) {
    const suggestion = Number(parsed.value.toPrecision(maxPriceSignificantFigures));
    return {
      error: `price "${raw}" has more than ${maxPriceSignificantFigures} significant figures (use ${suggestion})`,
    };
  }
  return { price: parsed.value };
}

export function parsePaste(input: string | undefined, resolveTicker: ResolveTicker): ParseResult {
  const result: ParseResult = { rows: [], errors: [] };
  if (input === undefined || input.trim().length === 0) {
    return result;
  }

  const prices = new Map<string, { price: number; line: number }>();

  // Split on every line-ending combination — a paste can arrive with \r alone.
  const lines = input.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (raw.length === 0) {
      continue;
    }
    const line = i + 1;

    const delimiter = detectDelimiter(raw);
    if (result.delimiter !== undefined && result.delimiter !== delimiter) {
      result.fatal = `Paste mixes ${delimiterNames[result.delimiter]} and ${delimiterNames[delimiter]} rows. Use one delimiter throughout.`;
      result.rows = [];
      result.errors = [];
      return result;
    }
    result.delimiter = delimiter;

    const fields = splitFields(raw, delimiter);
    if (fields.length < 2 || fields.length > 3) {
      result.errors.push({
        line,
        reason: `expected TICKER, QUANTITY[, PRICE] (got ${fields.length} fields)`,
      });
      continue;
    }

    const [tickerRaw, quantityRaw, priceRaw] = fields;
    const ticker = resolveTicker(tickerRaw);
    if (ticker === undefined) {
      result.errors.push({ line, reason: `unknown ticker "${tickerRaw}"` });
      continue;
    }
    const quantity = parseQuantity(quantityRaw);
    if ('error' in quantity) {
      result.errors.push({ line, reason: quantity.error });
      continue;
    }

    const row: ParsedRow = { ticker, amount: quantity.amount };
    if (priceRaw !== undefined && priceRaw.length > 0) {
      const price = parsePrice(priceRaw);
      if ('error' in price) {
        result.errors.push({ line, reason: price.error });
        continue;
      }
      // One ticker cannot carry two limits: the second row would silently win.
      const previous = prices.get(ticker);
      if (previous !== undefined && previous.price !== price.price) {
        result.errors.push({
          line,
          reason: `conflicting price for ${ticker}; line ${previous.line} used ${previous.price}`,
        });
        continue;
      }
      if (previous === undefined) {
        prices.set(ticker, { price: price.price, line });
      }
      row.price = price.price;
    }
    result.rows.push(row);
  }
  return result;
}

export interface MaterialBill {
  materials: Record<string, number>;
  prices?: Record<string, number>;
}

// Collapses a clean parse into the group's material bill. Returns undefined
// when anything failed to parse, so a partial paste never reaches the game.
export function parseMaterials(
  input: string | undefined,
  resolveTicker: ResolveTicker,
): MaterialBill | undefined {
  const { rows, errors, fatal } = parsePaste(input, resolveTicker);
  if (fatal !== undefined || errors.length > 0 || rows.length === 0) {
    return undefined;
  }
  const materials: Record<string, number> = {};
  let prices: Record<string, number> | undefined;
  for (const row of rows) {
    materials[row.ticker] = (materials[row.ticker] ?? 0) + row.amount;
    if (!Number.isSafeInteger(materials[row.ticker])) {
      return undefined;
    }
    if (row.price !== undefined) {
      prices ??= {};
      prices[row.ticker] = row.price;
    }
  }
  return { materials, prices };
}

export interface MaterialEntry {
  ticker: string;
  amount: number;
  price?: number;
}

export type TemplateType = 'BUY' | 'SELL' | 'SHIP';

// Everything the CONTD template panel can hold, minus loans. All fields are
// optional — import fills only what a paste provides and leaves the rest of
// the form untouched. `payment` is the SHIP contract total; the importer
// divides it evenly across shipment rows because the game charges the single
// price field once per row (same behavior as ACT's CONT_SEND).
export interface ContractDraftSpec {
  type?: TemplateType;
  currency?: string;
  deadline?: number;
  // BUY/SELL only.
  location?: string;
  // SHIP only. autoProvision: true = first store at the origin, false = off,
  // string = match a specific store option by text or value. The boolean
  // forms are the portable ones — store names/ids are account-specific.
  origin?: string;
  destination?: string;
  payment?: number;
  autoProvision?: string | boolean;
  materials: MaterialEntry[];
}

export interface ParseResult {
  error?: string;
  groupCount?: number;
  skipped?: number;
  spec: ContractDraftSpec;
}

export function emptySpec(): ContractDraftSpec {
  return { materials: [] };
}

export function specHasContractFields(spec: ContractDraftSpec): boolean {
  return (
    spec.type !== undefined ||
    spec.currency !== undefined ||
    spec.deadline !== undefined ||
    spec.location !== undefined ||
    spec.origin !== undefined ||
    spec.destination !== undefined ||
    spec.payment !== undefined ||
    spec.autoProvision !== undefined
  );
}

const templateTypeMap: Record<string, TemplateType> = {
  BUY: 'BUY',
  BUYING: 'BUY',
  SELL: 'SELL',
  SELLING: 'SELL',
  SHIP: 'SHIP',
  SHIPPING: 'SHIP',
};

function parseTemplateType(value: string): TemplateType | undefined {
  return templateTypeMap[value.trim().toUpperCase()];
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function describeSpecFields(spec: ContractDraftSpec): string[] {
  const fields: string[] = [];
  if (spec.type !== undefined) {
    fields.push(spec.type);
  }
  if (spec.currency !== undefined) {
    fields.push(spec.currency);
  }
  if (spec.location !== undefined) {
    fields.push('location');
  }
  if (spec.origin !== undefined) {
    fields.push('origin');
  }
  if (spec.destination !== undefined) {
    fields.push('destination');
  }
  if (spec.payment !== undefined) {
    fields.push('payment');
  }
  if (spec.autoProvision !== undefined) {
    fields.push('auto-provision');
  }
  if (spec.deadline !== undefined) {
    fields.push('deadline');
  }
  return fields;
}

function summarize(result: ParseResult): string {
  if (result.error) {
    return result.error;
  }
  const { spec, skipped } = result;
  const count = spec.materials.length;
  const parts = [`${count} material${count === 1 ? '' : 's'}`];
  const fields = describeSpecFields(spec);
  if (fields.length > 0) {
    parts.push(fields.join(', '));
  }
  const skippedText =
    skipped !== undefined && skipped > 0
      ? ` (${skipped} row${skipped === 1 ? '' : 's'} skipped)`
      : '';
  return `Parsed ${parts.join(' + ')}${skippedText}.`;
}

// --- PRUNplanner supply cart (materials only) ---

interface SupplyCartJson {
  groups?: Array<{ name?: string; materials?: Record<string, number> }>;
}

export function parseSupplyCart(json: string): ParseResult {
  if (json.trim() === '') {
    return { spec: emptySpec() };
  }

  let data: SupplyCartJson;
  try {
    data = JSON.parse(json);
  } catch {
    return { error: 'Invalid JSON.', spec: emptySpec() };
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];
  if (groups.length === 0) {
    return { error: 'No material groups found.', spec: emptySpec() };
  }

  const materials = groups.flatMap(group =>
    Object.entries(group.materials ?? {}).map(([ticker, amount]) => ({ ticker, amount })),
  );

  return { groupCount: groups.length, spec: { materials } };
}

export function summarizeSupplyCart(result: ParseResult): string {
  if (result.error) {
    return result.error;
  }
  if (result.groupCount === undefined) {
    return '';
  }
  const count = result.spec.materials.length;
  return `Parsed ${result.groupCount} group${result.groupCount === 1 ? '' : 's'}, ${count} material${count === 1 ? '' : 's'}.`;
}

// --- Sheets/Excel rows ---
//
// Material rows paste as tab-separated columns: amount, ticker, price.
// Contract-wide fields are key/value rows anywhere in the paste: the first
// cell is a keyword (template, currency, origin, ...), the second its value.
// The two never collide because material rows start with a number. Rows that
// parse as neither (e.g. a pasted header row like "Amount Material Price")
// are skipped rather than failing the whole paste.

type KeywordHandler = (spec: ContractDraftSpec, value: string) => boolean;

const keywordHandlers = new Map<string, KeywordHandler>([
  ['template', applyTemplateType],
  ['type', applyTemplateType],
  [
    'currency',
    (spec, value) => {
      spec.currency = value.trim().toUpperCase();
      return spec.currency !== '';
    },
  ],
  ['location', (spec, value) => applyText(value, v => (spec.location = v))],
  ['origin', (spec, value) => applyText(value, v => (spec.origin = v))],
  ['destination', (spec, value) => applyText(value, v => (spec.destination = v))],
  ['payment', applyPayment],
  ['price', applyPayment],
  [
    'deadline',
    (spec, value) => {
      spec.deadline = parsePositiveNumber(value);
      return spec.deadline !== undefined;
    },
  ],
  ['autoprovision', applyAutoProvision],
  ['auto-provision', applyAutoProvision],
]);

// Toggle words become the portable boolean form; any other non-empty value
// stays a string and matches a specific store by text or value.
const autoProvisionWords: Record<string, boolean> = {
  yes: true,
  true: true,
  on: true,
  no: false,
  false: false,
  off: false,
};

function applyAutoProvision(spec: ContractDraftSpec, value: string): boolean {
  return applyText(value, v => (spec.autoProvision = autoProvisionWords[v.toLowerCase()] ?? v));
}

function applyTemplateType(spec: ContractDraftSpec, value: string): boolean {
  spec.type = parseTemplateType(value);
  return spec.type !== undefined;
}

function applyPayment(spec: ContractDraftSpec, value: string): boolean {
  spec.payment = parsePositiveNumber(value);
  return spec.payment !== undefined;
}

function applyText(value: string, set: (value: string) => void): boolean {
  const trimmed = value.trim();
  if (trimmed === '') {
    return false;
  }
  set(trimmed);
  return true;
}

export function parseSheetsExcel(text: string): ParseResult {
  if (text.trim() === '') {
    return { spec: emptySpec() };
  }

  const spec = emptySpec();
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      continue;
    }

    const [firstCol, secondCol, thirdCol] = line.split('\t');

    const handler = keywordHandlers.get(firstCol?.trim().toLowerCase() ?? '');
    if (handler) {
      if (!handler(spec, secondCol ?? '')) {
        skipped++;
      }
      continue;
    }

    const amount = Number(firstCol?.trim());
    const ticker = secondCol?.trim().toUpperCase();
    if (!ticker || !Number.isFinite(amount)) {
      skipped++;
      continue;
    }

    const priceText = thirdCol?.trim();
    const parsedPrice = priceText ? Number(priceText) : undefined;
    const price = Number.isFinite(parsedPrice) ? parsedPrice : undefined;

    spec.materials.push({ ticker, amount, price });
  }

  if (spec.materials.length === 0 && !specHasContractFields(spec)) {
    return { error: 'No material or keyword rows found.', spec: emptySpec() };
  }

  return { spec, skipped };
}

export function summarizeSheetsExcel(result: ParseResult): string {
  return summarize(result);
}

// --- Contract JSON (the full spec, verbatim) ---

interface ContractJson {
  type?: unknown;
  currency?: unknown;
  deadline?: unknown;
  location?: unknown;
  origin?: unknown;
  destination?: unknown;
  payment?: unknown;
  autoProvision?: unknown;
  materials?: unknown;
}

function parseJsonMaterials(value: unknown): MaterialEntry[] | undefined {
  if (value === undefined) {
    return [];
  }
  // Both shapes are accepted: [{ticker, amount, price?}] and {TICKER: amount}.
  if (Array.isArray(value)) {
    const materials: MaterialEntry[] = [];
    for (const entry of value) {
      const ticker = typeof entry?.ticker === 'string' ? entry.ticker.trim().toUpperCase() : '';
      const amount = Number(entry?.amount);
      if (!ticker || !Number.isFinite(amount)) {
        return undefined;
      }
      const price = Number(entry?.price);
      materials.push({ ticker, amount, price: Number.isFinite(price) ? price : undefined });
    }
    return materials;
  }
  if (typeof value === 'object' && value !== null) {
    const materials: MaterialEntry[] = [];
    for (const [ticker, amount] of Object.entries(value)) {
      if (!Number.isFinite(Number(amount))) {
        return undefined;
      }
      materials.push({ ticker: ticker.trim().toUpperCase(), amount: Number(amount) });
    }
    return materials;
  }
  return undefined;
}

export function parseContractJson(json: string): ParseResult {
  if (json.trim() === '') {
    return { spec: emptySpec() };
  }

  let data: ContractJson;
  try {
    data = JSON.parse(json);
  } catch {
    return { error: 'Invalid JSON.', spec: emptySpec() };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { error: 'Expected a JSON object.', spec: emptySpec() };
  }

  const materials = parseJsonMaterials(data.materials);
  if (materials === undefined) {
    return { error: 'Invalid materials.', spec: emptySpec() };
  }

  const spec: ContractDraftSpec = { materials };

  if (data.type !== undefined) {
    spec.type = typeof data.type === 'string' ? parseTemplateType(data.type) : undefined;
    if (spec.type === undefined) {
      return { error: 'Invalid type (expected BUY, SELL, or SHIP).', spec: emptySpec() };
    }
  }
  if (data.currency !== undefined) {
    if (typeof data.currency !== 'string' || data.currency.trim() === '') {
      return { error: 'Invalid currency.', spec: emptySpec() };
    }
    spec.currency = data.currency.trim().toUpperCase();
  }
  for (const key of ['location', 'origin', 'destination'] as const) {
    const value = data[key];
    if (value !== undefined) {
      if (typeof value !== 'string' || value.trim() === '') {
        return { error: `Invalid ${key}.`, spec: emptySpec() };
      }
      spec[key] = value.trim();
    }
  }
  if (data.autoProvision !== undefined) {
    if (typeof data.autoProvision === 'boolean') {
      spec.autoProvision = data.autoProvision;
    } else if (typeof data.autoProvision === 'string' && data.autoProvision.trim() !== '') {
      spec.autoProvision = data.autoProvision.trim();
    } else {
      return { error: 'Invalid autoProvision.', spec: emptySpec() };
    }
  }
  for (const key of ['payment', 'deadline'] as const) {
    const value = data[key];
    if (value !== undefined) {
      const parsed = parsePositiveNumber(String(value));
      if (parsed === undefined) {
        return { error: `Invalid ${key}.`, spec: emptySpec() };
      }
      spec[key] = parsed;
    }
  }

  if (spec.materials.length === 0 && !specHasContractFields(spec)) {
    return { error: 'Empty contract.', spec: emptySpec() };
  }

  return { spec };
}

export function summarizeContractJson(result: ParseResult): string {
  return summarize(result);
}

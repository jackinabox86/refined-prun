import { parseRouteStep, type RouteStep } from '@src/features/XIT/RTACT/route-spec';

// A stop's own cargo settings: a set delivery in place of the supply-days bill, and
// extra steps in the XIT RTACT text syntax. Plain data in, plain data out.

const TICKER = /^[A-Z0-9]{1,4}$/;

export type SupplyResult =
  | { ok: true; supply?: Record<string, number> }
  | { ok: false; error: string };

// "RAT 120, DW 80" is a set delivery. "none" delivers nothing. Empty text goes back
// to the supply-days bill.
export function parseSupplyText(text: string): SupplyResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: true };
  }
  if (trimmed.toLowerCase() === 'none') {
    return { ok: true, supply: {} };
  }
  const supply: Record<string, number> = {};
  for (const part of trimmed.split(',')) {
    const tokens = part.trim().split(/\s+/);
    if (tokens.length !== 2) {
      return { ok: false, error: `"${part.trim()}" should be TICKER AMOUNT, as in RAT 120` };
    }
    const added = addSupply(supply, tokens[0], Number(tokens[1]));
    if (added !== undefined) {
      return { ok: false, error: added };
    }
  }
  return { ok: true, supply };
}

// The JSON form: {"RAT": 120, "DW": 80}.
export function checkSupply(value: unknown): SupplyResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'supply should be an object such as {"RAT": 120}' };
  }
  const supply: Record<string, number> = {};
  for (const [ticker, amount] of Object.entries(value)) {
    const added = addSupply(supply, ticker, amount);
    if (added !== undefined) {
      return { ok: false, error: added };
    }
  }
  return { ok: true, supply };
}

function addSupply(supply: Record<string, number>, rawTicker: string, amount: unknown) {
  const ticker = rawTicker.trim().toUpperCase();
  if (!TICKER.test(ticker)) {
    return `bad ticker "${rawTicker}"`;
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) {
    return `${ticker} amount must be a whole number, 0 or more`;
  }
  if (supply[ticker] !== undefined) {
    return `${ticker} is listed twice`;
  }
  if (amount > 0) {
    supply[ticker] = amount;
  }
  return undefined;
}

export function formatSupply(supply: Record<string, number> | undefined) {
  if (supply === undefined) {
    return '';
  }
  const parts = Object.entries(supply).map(([ticker, amount]) => `${ticker} ${amount}`);
  return parts.length > 0 ? parts.join(', ') : 'none';
}

export type StepsResult = { ok: true; steps: RouteStep[] } | { ok: false; error: string };

// Every saved step string, parsed. The first bad one names its place.
export function parseStopSteps(lines: readonly string[] | undefined): StepsResult {
  const steps: RouteStep[] = [];
  for (const [index, line] of (lines ?? []).entries()) {
    const parsed = parseRouteStep(line);
    if (!parsed.ok) {
      return { ok: false, error: `step ${index + 1} (${line.trim()}): ${parsed.error}` };
    }
    steps.push(parsed.step);
  }
  return { ok: true, steps };
}

// The editor's one-line form, steps split by "|", as on an XIT RTACT stop line.
export function splitStepsText(text: string) {
  return text
    .split('|')
    .map(x => x.trim())
    .filter(x => x.length > 0);
}

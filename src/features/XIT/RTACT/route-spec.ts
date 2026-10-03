export type WaitUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export interface UnitsLimit {
  mode: 'units';
  amount: number;
}

export interface CapacityLimit {
  mode: 'capacity';
}

export interface AllCarriedLimit {
  mode: 'all';
}

export type LoadLimit = UnitsLimit | CapacityLimit;
export type UnloadLimit = UnitsLimit | AllCarriedLimit;
export type RefuelLimit = UnitsLimit | CapacityLimit;

export interface LoadStep {
  kind: 'load';
  ticker: string;
  min: LoadLimit;
  max: LoadLimit;
}

export interface UnloadStep {
  kind: 'unload';
  ticker: string;
  min: UnloadLimit;
  max: UnloadLimit;
}

export interface WaitStep {
  kind: 'wait';
  amount: number;
  unit: WaitUnit;
}

export interface RefuelStep {
  kind: 'refuel';
  tank: 'STL' | 'FTL';
  source: 'ship' | 'local';
  min: RefuelLimit;
  max: RefuelLimit;
}

export type RouteStep = LoadStep | UnloadStep | WaitStep | RefuelStep;

export interface RouteStop {
  query: string;
  steps: RouteStep[];
  // Leg that flies to this waypoint. Absent when the text runner has no flight data.
  fuelUsage?: number;
  reactorUsage?: number;
  gateway?: boolean;
}

export interface RouteSpec {
  stops: RouteStop[];
  // Absent on a text spec, so the text runner leaves the game toggle alone.
  loop?: boolean;
}

export type ParseResult = { ok: true; spec: RouteSpec } | { ok: false; error: string };

const WAIT_UNITS: readonly WaitUnit[] = ['seconds', 'minutes', 'hours', 'days'];
const ROUTE_ID = /^RT-[A-Z0-9]+-\d+$/i;

export function parseRouteId(
  value: string,
): { ok: true; id?: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true };
  }
  if (!ROUTE_ID.test(trimmed)) {
    return { ok: false, error: 'Route id must look like RT-SUUL-0521' };
  }
  return { ok: true, id: trimmed.toUpperCase() };
}

export function parseRouteSpec(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const stops: RouteStop[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (raw.length === 0 || raw.startsWith('#')) {
      continue;
    }
    const parsed = parseStopLine(raw, i + 1);
    if (!parsed.ok) {
      return parsed;
    }
    stops.push(parsed.stop);
  }
  if (stops.length < 2) {
    return { ok: false, error: 'Need at least 2 stops' };
  }
  return { ok: true, spec: { stops } };
}

export function stepCommandLabel(step: RouteStep): string {
  switch (step.kind) {
    case 'load':
      return 'Load';
    case 'unload':
      return 'Unload';
    case 'refuel':
      return 'Refuel';
    case 'wait':
      return 'Wait';
  }
}

export function editorTitle(step: RouteStep): string {
  switch (step.kind) {
    case 'load':
      return 'Edit load step';
    case 'unload':
      return 'Edit unload step';
    case 'refuel':
      return 'Edit refuel step';
    case 'wait':
      return 'Edit wait step';
  }
}

export function tankLabel(tank: RefuelStep['tank']): string {
  return tank === 'STL' ? 'STL tank' : 'FTL tank';
}

export function sourceLabel(source: RefuelStep['source']): string {
  return source === 'ship' ? 'ship store' : 'local store';
}

function parseStopLine(
  raw: string,
  line: number,
): { ok: true; stop: RouteStop } | { ok: false; error: string } {
  const parts = raw.split('|').map(part => part.trim());
  const query = parts[0] ?? '';
  if (query.length === 0) {
    return { ok: false, error: `Line ${line}: missing stop` };
  }
  const steps: RouteStep[] = [];
  for (let i = 1; i < parts.length; i++) {
    const segment = parts[i];
    if (segment.length === 0) {
      return { ok: false, error: `Line ${line}: empty step` };
    }
    const parsed = parseStep(segment, line);
    if (!parsed.ok) {
      return parsed;
    }
    steps.push(parsed.step);
  }
  return { ok: true, stop: { query, steps } };
}

function parseStep(
  segment: string,
  line: number,
): { ok: true; step: RouteStep } | { ok: false; error: string } {
  const tokens = segment.split(/\s+/);
  const kind = tokens[0]?.toLowerCase();
  if (kind === 'load' || kind === 'unload' || kind === 'refuel') {
    return parseCargoStep(kind, tokens, line);
  }
  if (kind === 'wait') {
    return parseWait(tokens, line);
  }
  return { ok: false, error: `Line ${line}: unknown step "${tokens[0] ?? ''}"` };
}

function parseCargoStep(
  kind: 'load' | 'unload' | 'refuel',
  tokens: string[],
  line: number,
): { ok: true; step: RouteStep } | { ok: false; error: string } {
  if (kind === 'refuel') {
    if (tokens.length !== 5) {
      return { ok: false, error: `Line ${line}: refuel TANK ship|local MIN MAX` };
    }
    const tank = tokens[1].toUpperCase();
    const source = tokens[2].toLowerCase();
    if (tank !== 'STL' && tank !== 'FTL') {
      return { ok: false, error: `Line ${line}: tank must be STL or FTL` };
    }
    if (source !== 'ship' && source !== 'local') {
      return { ok: false, error: `Line ${line}: fuel source must be ship or local` };
    }
    const min = parseLimit(tokens[3], 'refuel', line, 'min');
    const max = parseLimit(tokens[4], 'refuel', line, 'max');
    if (!min.ok) {
      return min;
    }
    if (!max.ok) {
      return max;
    }
    return {
      ok: true,
      step: { kind: 'refuel', tank, source, min: min.limit, max: max.limit },
    };
  }
  if (tokens.length !== 4) {
    return { ok: false, error: `Line ${line}: ${kind} TICKER MIN MAX` };
  }
  const ticker = tokens[1].toUpperCase();
  if (!/^[A-Z0-9]{1,4}$/.test(ticker)) {
    return { ok: false, error: `Line ${line}: bad ticker "${tokens[1]}"` };
  }
  if (kind === 'load') {
    const min = parseLimit(tokens[2], 'load', line, 'min');
    const max = parseLimit(tokens[3], 'load', line, 'max');
    if (!min.ok) {
      return min;
    }
    if (!max.ok) {
      return max;
    }
    return { ok: true, step: { kind: 'load', ticker, min: min.limit, max: max.limit } };
  }
  const min = parseLimit(tokens[2], 'unload', line, 'min');
  const max = parseLimit(tokens[3], 'unload', line, 'max');
  if (!min.ok) {
    return min;
  }
  if (!max.ok) {
    return max;
  }
  return { ok: true, step: { kind: 'unload', ticker, min: min.limit, max: max.limit } };
}

function parseWait(
  tokens: string[],
  line: number,
): { ok: true; step: WaitStep } | { ok: false; error: string } {
  if (tokens.length !== 3) {
    return { ok: false, error: `Line ${line}: wait AMOUNT seconds|minutes|hours|days` };
  }
  const amount = Number(tokens[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: `Line ${line}: wait amount must be a positive number` };
  }
  const unit = tokens[2].toLowerCase();
  if (!WAIT_UNITS.includes(unit as WaitUnit)) {
    return { ok: false, error: `Line ${line}: wait unit must be seconds, minutes, hours, or days` };
  }
  return { ok: true, step: { kind: 'wait', amount, unit: unit as WaitUnit } };
}

function parseLimit(
  token: string,
  kind: 'load' | 'refuel',
  line: number,
  side: 'min' | 'max',
): { ok: true; limit: LoadLimit } | { ok: false; error: string };
function parseLimit(
  token: string,
  kind: 'unload',
  line: number,
  side: 'min' | 'max',
): { ok: true; limit: UnloadLimit } | { ok: false; error: string };
function parseLimit(
  token: string,
  kind: 'load' | 'unload' | 'refuel',
  line: number,
  side: 'min' | 'max',
): { ok: true; limit: LoadLimit | UnloadLimit } | { ok: false; error: string } {
  const word = token.toLowerCase();
  if (word === 'capacity') {
    if (kind === 'unload') {
      return { ok: false, error: `Line ${line}: unload uses units or all, not capacity` };
    }
    return { ok: true, limit: { mode: 'capacity' } };
  }
  if (word === 'all') {
    if (kind !== 'unload') {
      return { ok: false, error: `Line ${line}: ${kind} does not use all` };
    }
    return { ok: true, limit: { mode: 'all' } };
  }
  const amount = Number(token);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: `Line ${line}: ${side} must be a number, capacity, or all` };
  }
  return { ok: true, limit: { mode: 'units', amount } };
}

// JSON RouteSpec from the ROUTECONFIG bridge. The text parser does not carry flight fields.
export function parseRoutePayload(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Route payload is not JSON' };
  }
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: 'Route payload is not a route' };
  }
  const record = value as { stops?: unknown; loop?: unknown };
  if (!Array.isArray(record.stops)) {
    return { ok: false, error: 'Route payload is not a route' };
  }
  const stops: RouteStop[] = [];
  for (const entry of record.stops) {
    const parsed = parsePayloadStop(entry);
    if (!parsed.ok) {
      return parsed;
    }
    stops.push(parsed.stop);
  }
  if (stops.length < 2) {
    return { ok: false, error: 'Need at least 2 stops' };
  }
  if (record.loop !== undefined && typeof record.loop !== 'boolean') {
    return { ok: false, error: 'Route payload loop must be a boolean' };
  }
  return {
    ok: true,
    spec: record.loop === undefined ? { stops } : { stops, loop: record.loop },
  };
}

function parsePayloadStop(
  entry: unknown,
): { ok: true; stop: RouteStop } | { ok: false; error: string } {
  if (typeof entry !== 'object' || entry === null) {
    return { ok: false, error: 'Route payload stop is not an object' };
  }
  const record = entry as {
    query?: unknown;
    steps?: unknown;
    fuelUsage?: unknown;
    reactorUsage?: unknown;
    gateway?: unknown;
  };
  if (typeof record.query !== 'string' || record.query.trim().length === 0) {
    return { ok: false, error: 'Route payload stop is missing a query' };
  }
  if (!Array.isArray(record.steps)) {
    return { ok: false, error: 'Route payload stop is missing steps' };
  }
  const steps: RouteStep[] = [];
  for (const step of record.steps) {
    const parsed = parsePayloadStep(step);
    if (!parsed.ok) {
      return parsed;
    }
    steps.push(parsed.step);
  }
  const stop: RouteStop = { query: record.query, steps };
  if (record.fuelUsage !== undefined) {
    if (typeof record.fuelUsage !== 'number' || !Number.isFinite(record.fuelUsage)) {
      return { ok: false, error: 'Route payload fuel usage must be a number' };
    }
    stop.fuelUsage = record.fuelUsage;
  }
  if (record.reactorUsage !== undefined) {
    if (typeof record.reactorUsage !== 'number' || !Number.isFinite(record.reactorUsage)) {
      return { ok: false, error: 'Route payload reactor usage must be a number' };
    }
    stop.reactorUsage = record.reactorUsage;
  }
  if (record.gateway !== undefined) {
    if (typeof record.gateway !== 'boolean') {
      return { ok: false, error: 'Route payload gateway must be a boolean' };
    }
    stop.gateway = record.gateway;
  }
  return { ok: true, stop };
}

function parsePayloadStep(
  step: unknown,
): { ok: true; step: RouteStep } | { ok: false; error: string } {
  if (typeof step !== 'object' || step === null) {
    return { ok: false, error: 'Route payload step is not an object' };
  }
  const kind = (step as { kind?: unknown }).kind;
  if (kind === 'wait') {
    const wait = step as { amount?: unknown; unit?: unknown };
    if (typeof wait.amount !== 'number' || !Number.isFinite(wait.amount) || wait.amount <= 0) {
      return { ok: false, error: 'Route payload wait amount is invalid' };
    }
    if (
      wait.unit !== 'seconds' &&
      wait.unit !== 'minutes' &&
      wait.unit !== 'hours' &&
      wait.unit !== 'days'
    ) {
      return { ok: false, error: 'Route payload wait unit is invalid' };
    }
    return { ok: true, step: { kind: 'wait', amount: wait.amount, unit: wait.unit } };
  }
  if (kind === 'refuel') {
    const refuel = step as { tank?: unknown; source?: unknown; min?: unknown; max?: unknown };
    if (refuel.tank !== 'STL' && refuel.tank !== 'FTL') {
      return { ok: false, error: 'Route payload tank must be STL or FTL' };
    }
    if (refuel.source !== 'ship' && refuel.source !== 'local') {
      return { ok: false, error: 'Route payload fuel source must be ship or local' };
    }
    const min = payloadLimit(refuel.min, 'refuel');
    const max = payloadLimit(refuel.max, 'refuel');
    if (!min.ok) {
      return min;
    }
    if (!max.ok) {
      return max;
    }
    return {
      ok: true,
      step: {
        kind: 'refuel',
        tank: refuel.tank,
        source: refuel.source,
        min: min.limit,
        max: max.limit,
      },
    };
  }
  if (kind !== 'load' && kind !== 'unload') {
    return { ok: false, error: 'Route payload step kind is invalid' };
  }
  const cargo = step as { ticker?: unknown; min?: unknown; max?: unknown };
  if (typeof cargo.ticker !== 'string' || !/^[A-Z0-9]{1,4}$/.test(cargo.ticker)) {
    return { ok: false, error: 'Route payload ticker is invalid' };
  }
  if (kind === 'load') {
    const min = payloadLimit(cargo.min, 'load');
    const max = payloadLimit(cargo.max, 'load');
    if (!min.ok) {
      return min;
    }
    if (!max.ok) {
      return max;
    }
    return {
      ok: true,
      step: { kind: 'load', ticker: cargo.ticker, min: min.limit, max: max.limit },
    };
  }
  const min = payloadLimit(cargo.min, 'unload');
  const max = payloadLimit(cargo.max, 'unload');
  if (!min.ok) {
    return min;
  }
  if (!max.ok) {
    return max;
  }
  return {
    ok: true,
    step: { kind: 'unload', ticker: cargo.ticker, min: min.limit, max: max.limit },
  };
}

function payloadLimit(
  value: unknown,
  kind: 'load' | 'refuel',
): { ok: true; limit: LoadLimit } | { ok: false; error: string };
function payloadLimit(
  value: unknown,
  kind: 'unload',
): { ok: true; limit: UnloadLimit } | { ok: false; error: string };
function payloadLimit(
  value: unknown,
  kind: 'load' | 'unload' | 'refuel',
): { ok: true; limit: LoadLimit | UnloadLimit } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: 'Route payload limit is invalid' };
  }
  const mode = (value as { mode?: unknown }).mode;
  if (mode === 'capacity') {
    if (kind === 'unload') {
      return { ok: false, error: 'Route payload unload uses units or all, not capacity' };
    }
    return { ok: true, limit: { mode: 'capacity' } };
  }
  if (mode === 'all') {
    if (kind !== 'unload') {
      return { ok: false, error: 'Route payload load does not use all' };
    }
    return { ok: true, limit: { mode: 'all' } };
  }
  if (mode !== 'units') {
    return { ok: false, error: 'Route payload limit is invalid' };
  }
  const amount = (value as { amount?: unknown }).amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Route payload limit amount is invalid' };
  }
  return { ok: true, limit: { mode: 'units', amount } };
}

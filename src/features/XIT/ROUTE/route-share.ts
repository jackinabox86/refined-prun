import { snapDays } from '@src/features/XIT/ROUTE/route-calc';
import { repeatOriginKey, stopIdentity } from '@src/features/XIT/ROUTE/route-stops';
import type { WaitUnit } from '@src/features/XIT/RTACT/route-spec';

// The shareable JSON for one ROUTECONFIG route. Stops are natural ids (AI1, ZV-759c), so a
// route moves between players. Flight times and the game route id stay behind: they belong
// to one player's ship and game, and TRANSITS measures them again.
export const ROUTE_SHARE_FORMAT = 'rpr-route';
export const ROUTE_SHARE_VERSION = 1;

export interface RouteShareJson {
  format: typeof ROUTE_SHARE_FORMAT;
  version: typeof ROUTE_SHARE_VERSION;
  name: string;
  stops: { kind: 'cx' | 'base'; id: string }[];
  ship?: string;
  supplyDays?: number;
  loop: boolean;
  returnToOrigin?: boolean;
  wait?: { amount: number; unit: WaitUnit };
}

export type ImportedRoute = Omit<UserData.ShippingRoute, 'id'>;

export type RouteImportResult = { ok: true; route: ImportedRoute } | { ok: false; error: string };

const WAIT_UNITS: readonly WaitUnit[] = ['seconds', 'minutes', 'hours', 'days'];

export function exportRoute(route: UserData.ShippingRoute): RouteShareJson {
  const json: RouteShareJson = {
    format: ROUTE_SHARE_FORMAT,
    version: ROUTE_SHARE_VERSION,
    name: route.name,
    stops: route.stops.map(stop => ({ kind: stop.kind, id: stop.id })),
    loop: route.loop !== false,
  };
  if (route.ship !== undefined && route.ship.length > 0) {
    json.ship = route.ship;
  }
  if (route.days !== undefined) {
    json.supplyDays = route.days;
  }
  if (route.returnToOrigin !== undefined) {
    json.returnToOrigin = route.returnToOrigin;
  }
  if (route.wait !== undefined && route.wait.amount > 0) {
    json.wait = { amount: route.wait.amount, unit: route.wait.unit };
  }
  return json;
}

export function importRoute(text: string): RouteImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'Expected a JSON object.' };
  }
  const json = data as Record<string, unknown>;

  if (json.format !== undefined && json.format !== ROUTE_SHARE_FORMAT) {
    return { ok: false, error: `Not a route (format must be "${ROUTE_SHARE_FORMAT}").` };
  }
  if (json.version !== undefined) {
    if (typeof json.version !== 'number' || !Number.isInteger(json.version)) {
      return { ok: false, error: 'Invalid version.' };
    }
    if (json.version > ROUTE_SHARE_VERSION) {
      return { ok: false, error: `Route version ${json.version} is newer than this extension.` };
    }
  }

  let name = 'Imported route';
  if (json.name !== undefined) {
    if (typeof json.name !== 'string') {
      return { ok: false, error: 'Invalid name.' };
    }
    if (json.name.trim().length > 0) {
      name = json.name.trim();
    }
  }

  const stops = importStops(json.stops);
  if (typeof stops === 'string') {
    return { ok: false, error: stops };
  }
  const route: ImportedRoute = { name, stops };

  if (json.ship !== undefined) {
    if (typeof json.ship !== 'string') {
      return { ok: false, error: 'Invalid ship.' };
    }
    if (json.ship.trim().length > 0) {
      route.ship = json.ship.trim();
    }
  }
  if (json.supplyDays !== undefined) {
    if (typeof json.supplyDays !== 'number' || !(json.supplyDays >= 0)) {
      return { ok: false, error: 'Invalid supplyDays (expected a number, 0 or more).' };
    }
    route.days = snapDays(json.supplyDays);
  }
  if (json.loop !== undefined) {
    if (typeof json.loop !== 'boolean') {
      return { ok: false, error: 'Invalid loop (expected true or false).' };
    }
    route.loop = json.loop;
  }
  if (json.returnToOrigin !== undefined) {
    if (typeof json.returnToOrigin !== 'boolean') {
      return { ok: false, error: 'Invalid returnToOrigin (expected true or false).' };
    }
    route.returnToOrigin = json.returnToOrigin;
  }
  if (json.wait !== undefined) {
    const wait = importWait(json.wait);
    if (typeof wait === 'string') {
      return { ok: false, error: wait };
    }
    route.wait = wait;
  }
  return { ok: true, route };
}

function importStops(value: unknown): UserData.ShippingRouteStop[] | string {
  if (!Array.isArray(value) || value.length === 0) {
    return 'Invalid stops (expected a list of {"kind": "cx" | "base", "id": ...}).';
  }
  const stops: UserData.ShippingRouteStop[] = [];
  for (let i = 0; i < value.length; i++) {
    const entry = value[i] as Record<string, unknown> | null;
    const kind = typeof entry === 'object' && entry !== null ? entry.kind : undefined;
    const rawId = typeof entry === 'object' && entry !== null ? entry.id : undefined;
    if ((kind !== 'cx' && kind !== 'base') || typeof rawId !== 'string') {
      return `Invalid stop ${i + 1} (expected {"kind": "cx" | "base", "id": ...}).`;
    }
    const trimmed = rawId.trim();
    if (trimmed.length === 0) {
      return `Invalid stop ${i + 1} (empty id).`;
    }
    // Exchange codes are upper case. Planet ids keep their case (ZV-759c).
    const id = kind === 'cx' ? trimmed.toUpperCase() : trimmed;
    const stop: UserData.ShippingRouteStop = { kind, id };
    const origin = stops[0];
    if (stops.some(x => stopIdentity(x) === stopIdentity(stop))) {
      if (origin === undefined || stopIdentity(origin) !== stopIdentity(stop)) {
        return `Stop ${i + 1} (${id}) is already on the route. Only the first stop can repeat.`;
      }
      stop.key = repeatOriginKey(stop);
    }
    stops.push(stop);
  }
  return stops;
}

function importWait(value: unknown): UserData.ShippingRoute['wait'] | string {
  const error = 'Invalid wait (expected {"amount": 3, "unit": "days"}).';
  if (typeof value !== 'object' || value === null) {
    return error;
  }
  const { amount, unit } = value as Record<string, unknown>;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    return error;
  }
  if (!WAIT_UNITS.includes(unit as WaitUnit)) {
    return error;
  }
  return amount > 0 ? { amount, unit: unit as WaitUnit } : undefined;
}

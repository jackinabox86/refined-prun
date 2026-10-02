const cache = new Map<string, boolean>();

export function readHasLocalMarket(body: unknown) {
  if (typeof body !== 'object' || body === null || !Object.hasOwn(body, 'HasLocalMarket')) {
    return undefined;
  }
  const value = (body as { HasLocalMarket: unknown }).HasLocalMarket;
  if (typeof value !== 'boolean') {
    return undefined;
  }
  return value;
}

export async function fetchPlanetHasLocalMarket(naturalId: string) {
  const key = naturalId.toUpperCase();
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let response: Response;
  try {
    response = await fetch(`https://rest.fnar.net/planet/${encodeURIComponent(naturalId)}`);
  } catch {
    return undefined;
  }
  if (!response.ok) {
    return undefined;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return undefined;
  }

  const value = readHasLocalMarket(body);
  if (value === undefined) {
    return undefined;
  }
  cache.set(key, value);
  return value;
}

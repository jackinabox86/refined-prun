// Identity of a saved stop, and where a repeated origin splits the route.
// Plain data in, plain data out. The buffer only supplies the stops.

export function stopIdentity(stop: { kind: string; id: string }) {
  return `${stop.kind}:${stop.id}`;
}

// A repeated origin carries its own key. Every other stop is identified by kind and id.
export function stopInstanceKey(stop: { kind: string; id: string; key?: string }) {
  if (stop.key !== undefined && stop.key.length > 0) {
    return stop.key;
  }
  return stopIdentity(stop);
}

export function repeatOriginKey(stop: { kind: string; id: string }) {
  return `${stop.kind}:${stop.id}#${crypto.randomUUID()}`;
}

export function originVisitIndexes<T extends { kind: string; id: string }>(stops: readonly T[]) {
  const origin = stops[0];
  if (origin === undefined) {
    return [];
  }
  const indexes: number[] = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (stop !== undefined && stop.kind === origin.kind && stop.id === origin.id) {
      indexes.push(i);
    }
  }
  return indexes;
}

export function isLaterOriginVisit<T extends { kind: string; id: string }>(
  stops: readonly T[],
  index: number,
) {
  return index > 0 && originVisitIndexes(stops).includes(index);
}

// Accept a drop from the pool. A later copy of the first stop is a new origin visit.
// Any other stop already on the route is refused.
export function acceptDroppedStop<T extends { kind: 'cx' | 'base'; id: string }>(
  stops: readonly { kind: string; id: string }[],
  dropped: T,
): (T & { key?: string }) | undefined {
  const duplicate = stops.some(stop => stopIdentity(stop) === stopIdentity(dropped));
  if (!duplicate) {
    return dropped;
  }
  const origin = stops[0];
  if (origin === undefined || dropped.kind !== origin.kind || dropped.id !== origin.id) {
    return undefined;
  }
  return { ...dropped, key: repeatOriginKey(dropped) };
}

export function routeSegments<T extends { kind: string; id: string }>(stops: readonly T[]) {
  const indexes = originVisitIndexes(stops);
  const segments: T[][] = [];
  for (let i = 0; i < indexes.length; i++) {
    const start = indexes[i] ?? 0;
    const end = indexes[i + 1] ?? stops.length;
    segments.push(stops.slice(start, end));
  }
  return segments;
}

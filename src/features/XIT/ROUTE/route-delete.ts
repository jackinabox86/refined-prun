// A config route is linked only by the game id SET ROUTE stored on it. Routes built
// before that id was kept show as unlinked: matching stops is fine for ASSIGN, but it
// is not proof enough to delete a game route.
export function linkedRtId(route: { rtId?: string }): string | undefined {
  const id = route.rtId?.trim() ?? '';
  return id.length > 0 ? id : undefined;
}

export function deleteConfirmMessage(input: {
  name: string;
  rtId: string | undefined;
  ships: readonly string[];
}): string {
  if (input.rtId === undefined) {
    return `Delete ${input.name}? It is not linked to a game route, so only the ROUTECONFIG route is removed.`;
  }
  const lines = [
    `Delete ${input.name} and its game route ${input.rtId}?`,
    'XIT ROUTEDEL deletes the game route first, one ACT press at a time.',
    `If the game route is not deleted, ${input.name} is kept.`,
  ];
  if (input.ships.length > 0) {
    lines.push(
      `${input.ships.join(', ')} ${input.ships.length === 1 ? 'is' : 'are'} on ${input.rtId}.`,
    );
  }
  return lines.join(' ');
}

// The RT view names a route with its in-game name, or with its id when it was never
// renamed. The id must be a whole text on its own, and the name is the one other text
// beside it. Anything else is unknown (undefined), never a guess.
export function routeNameFrom(texts: readonly string[], rtId: string): string | undefined {
  const id = rtId.trim().toUpperCase();
  const shown = texts.map(text => text.trim()).filter(text => text.length > 0);
  if (id.length === 0 || !shown.some(text => text.toUpperCase() === id)) {
    return undefined;
  }
  const others = shown.filter(text => text.toUpperCase() !== id);
  if (others.length === 0) {
    return rtId.trim();
  }
  return others.length === 1 ? others[0] : undefined;
}

// The RT list is Name | Waypoints | Assigned Ships | Created | view copy delete. The list
// shows a renamed route by its name only, so a row matches on its whole Name cell being
// the route's name or its id. Rows, not the id alone, decide what gets deleted.
export function routeRowIndices(
  rows: readonly (readonly string[])[],
  rtId: string,
  name: string,
): number[] {
  const keys = new Set(
    [rtId, name].map(text => text.trim().toUpperCase()).filter(text => text.length > 0),
  );
  const hits: number[] = [];
  for (let index = 0; index < rows.length; index++) {
    if (keys.has((rows[index][0] ?? '').trim().toUpperCase())) {
      hits.push(index);
    }
  }
  return hits;
}

// The game's own view of the route id says so when no route has that id.
export function gameRouteMissing(viewText: string): boolean {
  return /no route found/i.test(viewText);
}

// Removed means exactly one row fewer and no row still matches the route.
export function routeRowRemoved(
  before: readonly (readonly string[])[],
  after: readonly (readonly string[])[],
  rtId: string,
  name: string,
): boolean {
  return after.length === before.length - 1 && routeRowIndices(after, rtId, name).length === 0;
}

// Only a control whose whole label is `delete`. One row has one.
export function rowDeleteIndex(labels: readonly string[]) {
  const hits: number[] = [];
  for (let index = 0; index < labels.length; index++) {
    if (labels[index].trim().toLowerCase() === 'delete') {
      hits.push(index);
    }
  }
  return hits.length === 1 ? hits[0] : undefined;
}

export type GameDeleteResult =
  | { kind: 'deleted' }
  | { kind: 'absent' }
  | { kind: 'kept'; reason: string };

// The config route goes only once the game route is gone. A game route that is still
// listed keeps the config route, so the two never drift apart silently.
export function deleteOutcome(
  result: GameDeleteResult,
  name: string,
  rtId: string,
): { removeConfig: boolean; level: 'success' | 'warning' | 'error'; message: string } {
  if (result.kind === 'deleted') {
    return { removeConfig: true, level: 'success', message: `Deleted ${rtId} and ${name}` };
  }
  if (result.kind === 'absent') {
    return {
      removeConfig: true,
      level: 'warning',
      message: `${rtId} is not in your RT list, so only ${name} was removed`,
    };
  }
  return {
    removeConfig: false,
    level: 'error',
    message: `${rtId} was not deleted (${result.reason}). ${name} is kept in ROUTECONFIG.`,
  };
}

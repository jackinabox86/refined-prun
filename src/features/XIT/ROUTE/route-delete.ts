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

// The RT list is Name | Waypoints | Assigned Ships | Created | view copy delete. The
// id must be a row's whole first cell, and exactly one row may carry it.
export function rtListRowIndex(rows: readonly (readonly string[])[], rtId: string) {
  const wanted = rtId.trim().toUpperCase();
  if (wanted.length === 0) {
    return undefined;
  }
  const hits: number[] = [];
  for (let index = 0; index < rows.length; index++) {
    if ((rows[index][0] ?? '').trim().toUpperCase() === wanted) {
      hits.push(index);
    }
  }
  return hits.length === 1 ? hits[0] : undefined;
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

import { describe, expect, it } from 'vitest';
import {
  deleteConfirmMessage,
  deleteOutcome,
  gameRouteMissing,
  linkedRtId,
  routeNameFrom,
  routeRowIndices,
  routeRowRemoved,
  rowDeleteIndex,
} from '@src/features/XIT/ROUTE/route-delete';

describe('linkedRtId', () => {
  it('links the game id SET ROUTE stored', () => {
    expect(linkedRtId({ rtId: ' RT-WTMP-4226 ' })).toBe('RT-WTMP-4226');
  });

  it('does not link a route without a stored game id', () => {
    expect(linkedRtId({})).toBeUndefined();
    expect(linkedRtId({ rtId: '   ' })).toBeUndefined();
  });
});

describe('deleteConfirmMessage', () => {
  it('says an unlinked route is removed alone', () => {
    expect(deleteConfirmMessage({ name: 'Route 1', rtId: undefined, ships: [] })).toBe(
      'Delete Route 1? It is not linked to a game route, so only the ROUTECONFIG route is removed.',
    );
  });

  it('names the game route and the ships on it', () => {
    const text = deleteConfirmMessage({
      name: 'Route 1',
      rtId: 'RT-WTMP-4226',
      ships: ['Hauler'],
    });
    expect(text).toContain('Delete Route 1 and its game route RT-WTMP-4226?');
    expect(text).toContain('If the game route is not deleted, Route 1 is kept.');
    expect(text).toContain('Hauler is on RT-WTMP-4226.');
  });
});

describe('routeNameFrom', () => {
  it('reads the custom name beside the id', () => {
    expect(routeNameFrom(['custom route', 'RT-SQPJ-5847'], 'RT-SQPJ-5847')).toBe('custom route');
  });

  it('uses the id when the route was never renamed', () => {
    expect(routeNameFrom(['RT-WTMP-4226'], 'RT-WTMP-4226')).toBe('RT-WTMP-4226');
  });

  it('is unknown when the id is not shown or several texts could be the name', () => {
    expect(routeNameFrom(['custom route'], 'RT-SQPJ-5847')).toBeUndefined();
    expect(routeNameFrom(['a', 'b', 'RT-SQPJ-5847'], 'RT-SQPJ-5847')).toBeUndefined();
  });
});

describe('routeRowIndices', () => {
  const rows = [
    ['RT-WTMP-4226', '3', '--', '7 hours ago', 'viewcopydelete'],
    ['custom route', '14', '--', '7 hours ago', 'viewcopydelete'],
  ];

  it('finds a renamed route by its name, not its id', () => {
    expect(routeRowIndices(rows, 'RT-SQPJ-5847', 'custom route')).toEqual([1]);
  });

  it('finds an unrenamed route by its id', () => {
    expect(routeRowIndices(rows, 'rt-wtmp-4226', 'RT-WTMP-4226')).toEqual([0]);
  });

  it('does not match an id inside joined cell text', () => {
    expect(routeRowIndices([['deleteRT-SNXV-3853']], 'RT-SNXV-3853', 'x')).toEqual([]);
    expect(routeRowIndices([['Other', 'RT-SNXV-3853']], 'RT-SNXV-3853', 'Other')).toEqual([0]);
    expect(routeRowIndices([['Other', 'RT-SNXV-3853']], 'RT-SNXV-3853', 'RT-SNXV-3853')).toEqual(
      [],
    );
  });

  it('reports every row that could be the route, so a duplicate name is ambiguous', () => {
    expect(routeRowIndices([rows[1], rows[1]], 'RT-SQPJ-5847', 'custom route')).toEqual([0, 1]);
    expect(routeRowIndices(rows, 'RT-PNWB-2005', 'Other')).toEqual([]);
  });
});

describe('gameRouteMissing', () => {
  it('reads the game view that says no route has the id', () => {
    expect(gameRouteMissing('RT RT-SQPJ-5847 RT RTE FLT No route found.')).toBe(true);
    expect(gameRouteMissing('custom route RT-SQPJ-5847 ADD WAYPOINT')).toBe(false);
  });
});

describe('routeRowRemoved', () => {
  const before = [
    ['custom route', '14', '--', '7 hours ago', 'viewcopydelete'],
    ['RT-WTMP-4226', '3', '--', '7 hours ago', 'viewcopydelete'],
  ];

  it('is removed when one row fewer remains and none still matches', () => {
    expect(routeRowRemoved(before, [before[1]], 'RT-SQPJ-5847', 'custom route')).toBe(true);
  });

  it('is not removed while the route is still listed or the count did not drop by one', () => {
    expect(routeRowRemoved(before, before, 'RT-SQPJ-5847', 'custom route')).toBe(false);
    expect(routeRowRemoved(before, [], 'RT-SQPJ-5847', 'custom route')).toBe(false);
    expect(routeRowRemoved(before, [before[0]], 'RT-WTMP-4226', 'custom route')).toBe(false);
  });
});

describe('rowDeleteIndex', () => {
  it('finds the row delete control', () => {
    expect(rowDeleteIndex(['view', 'copy', 'delete'])).toBe(2);
  });

  it('does not pick other delete-like controls or an ambiguous row', () => {
    expect(rowDeleteIndex(['view', 'Delete waypoint'])).toBeUndefined();
    expect(rowDeleteIndex(['copy', 'Delete step'])).toBeUndefined();
    expect(rowDeleteIndex(['delete', 'delete'])).toBeUndefined();
  });
});

describe('deleteOutcome', () => {
  it('removes the config route once the game route is deleted', () => {
    expect(deleteOutcome({ kind: 'deleted' }, 'Route 1', 'RT-WTMP-4226')).toEqual({
      removeConfig: true,
      level: 'success',
      message: 'Deleted RT-WTMP-4226 and Route 1',
    });
  });

  it('removes the config route with a warning when the game route is already gone', () => {
    const outcome = deleteOutcome({ kind: 'absent' }, 'Route 1', 'RT-WTMP-4226');
    expect(outcome.removeConfig).toBe(true);
    expect(outcome.level).toBe('warning');
    expect(outcome.message).toBe(
      'RT-WTMP-4226 is not in your RT list, so only Route 1 was removed',
    );
  });

  it('does not remove the config route when the game route was not deleted', () => {
    const outcome = deleteOutcome(
      { kind: 'kept', reason: 'it is still in the RT list' },
      'Route 1',
      'RT-WTMP-4226',
    );
    expect(outcome.removeConfig).toBe(false);
    expect(outcome.level).toBe('error');
    expect(outcome.message).toBe(
      'RT-WTMP-4226 was not deleted (it is still in the RT list). Route 1 is kept in ROUTECONFIG.',
    );
  });
});

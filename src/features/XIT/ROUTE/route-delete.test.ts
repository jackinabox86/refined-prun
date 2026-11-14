import { describe, expect, it } from 'vitest';
import {
  deleteConfirmMessage,
  deleteOutcome,
  linkedRtId,
  rowDeleteIndex,
  rtListRowIndex,
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

describe('rtListRowIndex', () => {
  const rows = [
    ['RT-WTMP-4226', '3', '--', '7 hours ago', 'viewcopydelete'],
    ['RT-SSSV-8222', '14', '--', '7 hours ago', 'viewcopydelete'],
  ];

  it('finds the row whose first cell is the id', () => {
    expect(rtListRowIndex(rows, 'rt-sssv-8222')).toBe(1);
  });

  it('does not match an id inside joined cell text', () => {
    expect(rtListRowIndex([['deleteRT-SNXV-3853']], 'RT-SNXV-3853')).toBeUndefined();
    expect(rtListRowIndex([['x', 'RT-SNXV-3853']], 'RT-SNXV-3853')).toBeUndefined();
  });

  it('does not pick a row when the id is missing or listed twice', () => {
    expect(rtListRowIndex(rows, 'RT-PNWB-2005')).toBeUndefined();
    expect(rtListRowIndex([rows[0], rows[0]], 'RT-WTMP-4226')).toBeUndefined();
    expect(rtListRowIndex(rows, ' ')).toBeUndefined();
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

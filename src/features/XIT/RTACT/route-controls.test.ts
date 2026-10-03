import { describe, expect, it } from 'vitest';
import {
  assertEditorClick,
  blockIndex,
  isAddWaypointArmed,
  isRouteLoopText,
  loopSwitchLit,
  waypointFieldIndex,
  isStepEditLabel,
  amountRowIndex,
  limitClick,
  modeRowIndex,
  newRouteId,
  pickSuggestion,
  routeIdsInCells,
  selectControlLabel,
  shipAssignment,
  shouldClickAddWaypoint,
  waypointNeedles,
  type LimitNode,
} from './route-controls';

describe('isRouteLoopText', () => {
  it('accepts the settings row that repeats Loop', () => {
    expect(isRouteLoopText('Loop')).toBe(true);
    expect(isRouteLoopText('Loop Loop')).toBe(true);
    expect(isRouteLoopText('Loop waypoint')).toBe(false);
  });
});

describe('loopSwitchLit', () => {
  it('reads the staging switch colors', () => {
    expect(loopSwitchLit('rgb(221, 221, 221)')).toBe(true);
    expect(loopSwitchLit('rgb(153, 153, 153)')).toBe(false);
    expect(loopSwitchLit('rgb(39, 39, 39)')).toBe(false);
  });
});

describe('waypointFieldIndex', () => {
  it('picks the Enter location field next to ADD WAYPOINT', () => {
    const fields = [
      { x: 48, y: -4, width: 179, height: 16 },
      { x: 515, y: 150, width: 125, height: 18 },
    ];
    const buttons = [{ x: 543, y: 170, width: 100, height: 17 }];
    expect(waypointFieldIndex(fields, buttons)).toBe(1);
    expect(waypointFieldIndex([fields[0]!], buttons)).toBeUndefined();
  });
});

describe('selectControlLabel', () => {
  const controls = [
    { label: 'Delete waypoint', danger: true },
    { label: 'ADD WAYPOINT' },
    { label: 'CREATE ROUTE' },
  ];

  it('does not activate a delete control', () => {
    expect(() => selectControlLabel(controls, 'Delete waypoint')).toThrow(/delete/i);
    expect(() => selectControlLabel(controls, 'delete')).toThrow(/delete/i);
  });

  it('returns the add control when that is the label asked for', () => {
    expect(selectControlLabel(controls, 'ADD WAYPOINT')).toBe('ADD WAYPOINT');
  });

  it('does not arm a neutral or disabled add button', () => {
    expect(() =>
      selectControlLabel([{ label: 'ADD WAYPOINT', neutral: true }], 'ADD WAYPOINT', {
        requireArmed: true,
      }),
    ).toThrow(/not armed/);
  });
});

describe('shouldClickAddWaypoint', () => {
  it('does not click when the suggestion was not picked', () => {
    expect(shouldClickAddWaypoint({ suggestionPicked: false, armed: true })).toBe(false);
  });

  it('does not click when the button is not armed', () => {
    expect(shouldClickAddWaypoint({ suggestionPicked: true, armed: false })).toBe(false);
  });

  it('clicks only after a suggestion pick on an armed button', () => {
    expect(shouldClickAddWaypoint({ suggestionPicked: true, armed: true })).toBe(true);
    expect(isAddWaypointArmed({ disabled: false, neutral: false, danger: false })).toBe(true);
    expect(isAddWaypointArmed({ disabled: false, neutral: true, danger: false })).toBe(false);
    expect(isAddWaypointArmed({ disabled: true, neutral: false, danger: false })).toBe(false);
    expect(isAddWaypointArmed({ disabled: false, neutral: false, danger: true })).toBe(false);
  });
});

describe('assertEditorClick', () => {
  it('does not click SAVE, CANCEL, or delete', () => {
    expect(() => assertEditorClick('SAVE')).toThrow(/refusing editor click/i);
    expect(() => assertEditorClick('CANCEL')).toThrow(/refusing editor click/i);
    expect(() => assertEditorClick('Delete waypoint')).toThrow(/refusing editor click/i);
  });

  it('allows a capacity mode word', () => {
    expect(() => assertEditorClick('capacity')).not.toThrow();
    expect(limitClick(true, 'capacity')).toBe('capacity');
    expect(limitClick(true, 'units')).toBeUndefined();
    expect(limitClick(true, 'all')).toBe('all carried');
    expect(limitClick(false, 'all')).toBeUndefined();
  });
});

describe('isStepEditLabel', () => {
  it('does not treat delete or the waypoint pencil as a step edit', () => {
    expect(isStepEditLabel('Delete waypoint')).toBe(false);
    expect(isStepEditLabel('Edit waypoint')).toBe(false);
    expect(isStepEditLabel('Edit')).toBe(true);
  });
});

describe('pickSuggestion', () => {
  const labels = [
    'Antares II - Deimos (ZV-759c)',
    'Antares Station (Antares)',
    'Antares I - Phobos (ZV-307d)',
  ];

  it('does not pick the first default row when the query is a later id', () => {
    expect(pickSuggestion(labels, 'ZV-307d')).toBe('Antares I - Phobos (ZV-307d)');
  });

  it('returns undefined when nothing matches', () => {
    expect(pickSuggestion(labels, 'no-such-body')).toBeUndefined();
  });
});

describe('blockIndex', () => {
  it('does not stay on the header when a parent holds the step pencil', () => {
    expect(blockIndex([0, 0, 1, 4])).toBe(2);
  });

  it('stays on the header when no ancestor has a pencil', () => {
    expect(blockIndex([0, 0, 0])).toBe(0);
  });
});

describe('waypointNeedles', () => {
  it('includes the station display name a row actually shows', () => {
    expect(waypointNeedles('HRT', 'OT-580', 'Hortus Station')).toEqual([
      'OT-580',
      'HRT',
      'Hortus Station',
    ]);
  });

  it('drops a blank station name', () => {
    expect(waypointNeedles('ZV-307d', 'ZV-307d', '  ')).toEqual(['ZV-307d']);
  });
});

function measuredEditor(): LimitNode[] {
  return [
    {
      text: 'MinimumunitscapacityMinimum unitsMaximumunitscapacityMaximum units',
      inputs: 2,
      parent: undefined,
    },
    { text: 'Minimumunitscapacity', inputs: 0, parent: 0 },
    { text: 'Minimum', inputs: 0, parent: 1 },
    { text: 'units', inputs: 0, parent: 1 },
    { text: 'capacity', inputs: 0, parent: 1 },
    { text: 'Minimum units', inputs: 1, parent: 0 },
    { text: 'Maximumunitscapacity', inputs: 0, parent: 0 },
    { text: 'Maximum', inputs: 0, parent: 6 },
    { text: 'units', inputs: 0, parent: 6 },
    { text: 'capacity', inputs: 0, parent: 6 },
    { text: 'Maximum units', inputs: 1, parent: 0 },
  ];
}

describe('limit rows', () => {
  it('does not match mode words inside Minimumunitscapacity', () => {
    expect(/\b(units|capacity)\b/i.test('Minimumunitscapacity')).toBe(false);
  });

  it('does not use the form for both the minimum and maximum amounts', () => {
    const nodes = measuredEditor();
    const minimum = amountRowIndex(nodes, 'Minimum');
    const maximum = amountRowIndex(nodes, 'Maximum');
    expect(minimum).toBe(5);
    expect(maximum).toBe(10);
    expect(minimum).not.toBe(maximum);
  });

  it('uses the heading parent as the mode row', () => {
    const nodes = measuredEditor();
    expect(modeRowIndex(nodes, 'Minimum')).toBe(1);
    expect(modeRowIndex(nodes, 'Maximum')).toBe(6);
    const nested: LimitNode[] = [
      { text: 'Minimumunitscapacity', inputs: 0, parent: undefined },
      { text: 'Minimum', inputs: 0, parent: 0 },
      { text: 'Minimum', inputs: 0, parent: 1 },
    ];
    expect(modeRowIndex(nested, 'Minimum')).toBe(0);
  });
});

describe('newRouteId', () => {
  it('returns the single id that appeared', () => {
    expect(newRouteId(['RT-SNXV-3853'], ['RT-SNXV-3853', 'RT-SUUL-0521'])).toBe('RT-SUUL-0521');
  });

  it('returns undefined when the list did not gain exactly one id', () => {
    expect(newRouteId(['RT-SNXV-3853'], ['RT-SNXV-3853'])).toBeUndefined();
    expect(newRouteId([], ['RT-AAAA-0001', 'RT-BBBB-0002'])).toBeUndefined();
  });
});

describe('routeIdsInCells', () => {
  it('reads ids from whole cells, not from the joined table text', () => {
    // Measured staging RT list: textContent glues the waypoint count onto the id.
    const table =
      'NameWaypointsAssigned ShipsCreatedRT-PNWB-20050--3 minutes agodeleteRT-SNXV-38533AVI-0008Z3 days agodelete';
    const before = [table.replace('RT-PNWB-20050--3 minutes agodelete', ''), ' RT-SNXV-3853 ', '3'];
    const after = [table, 'RT-PNWB-2005', '0', '--', 'delete', ' RT-SNXV-3853 ', 'AVI-0008Z'];
    expect(routeIdsInCells(after)).toEqual(['RT-PNWB-2005', 'RT-SNXV-3853']);
    expect(newRouteId(routeIdsInCells(before), routeIdsInCells(after))).toBe('RT-PNWB-2005');
  });
});

describe('shipAssignment', () => {
  // Measured staging route view, RT-RUJT-2222.
  const rows = [
    ['AVI-00090', '--', 'ASSIGN'],
    ['AVI-0008Z', 'RT-SNXV-3853', 'execution'],
  ];

  it('finds the free ship and its ASSIGN row', () => {
    expect(shipAssignment(rows, ['avi-00090'], 'RT-RUJT-2222')).toEqual({ kind: 'free', row: 0 });
  });

  it('refuses a ship that is already on another route', () => {
    expect(shipAssignment(rows, ['AVI-0008Z'], 'RT-RUJT-2222')).toEqual({
      kind: 'busy',
      route: 'RT-SNXV-3853',
      cmds: 'execution',
    });
  });

  it('reports a ship already on this route', () => {
    expect(shipAssignment(rows, ['AVI-0008Z'], 'rt-snxv-3853')).toEqual({ kind: 'here' });
  });

  it('matches the ship name cell exactly, not by substring', () => {
    expect(shipAssignment(rows, ['AVI-0009'], 'RT-RUJT-2222')).toEqual({ kind: 'missing' });
  });
});

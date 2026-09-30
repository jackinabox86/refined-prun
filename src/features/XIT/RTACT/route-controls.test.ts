import { describe, expect, it } from 'vitest';
import {
  assertEditorClick,
  isAddWaypointArmed,
  isStepEditLabel,
  limitClick,
  newRouteId,
  pickSuggestion,
  selectControlLabel,
  shouldClickAddWaypoint,
} from './route-controls';

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

describe('newRouteId', () => {
  it('returns the single id that appeared', () => {
    expect(newRouteId(['RT-SNXV-3853'], ['RT-SNXV-3853', 'RT-SUUL-0521'])).toBe('RT-SUUL-0521');
  });

  it('returns undefined when the list did not gain exactly one id', () => {
    expect(newRouteId(['RT-SNXV-3853'], ['RT-SNXV-3853'])).toBeUndefined();
    expect(newRouteId([], ['RT-AAAA-0001', 'RT-BBBB-0002'])).toBeUndefined();
  });
});

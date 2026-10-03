import { describe, expect, it } from 'vitest';
import { applyWaypointQuery } from '@src/infrastructure/prun-ui/utils/address-query';

function hostWith(props: object, parentProps?: object) {
  return {
    value: '',
    __reactFiber$test: {
      memoizedProps: props,
      return: parentProps === undefined ? null : { memoizedProps: parentProps, return: null },
    },
  };
}

describe('applyWaypointQuery', () => {
  it('calls onChange and onFocus with the query', () => {
    const calls: unknown[] = [];
    const host = hostWith({
      onFocus(value: unknown) {
        calls.push(['focus', value]);
      },
      onChange(value: unknown) {
        calls.push(['change', value]);
      },
    });
    expect(applyWaypointQuery(host, 'Antares Station').ok).toBe(true);
    expect(calls).toEqual([
      ['focus', 'Antares Station'],
      ['change', 'Antares Station'],
    ]);
    expect(host.value).toBe('Antares Station');
  });

  it('calls an event handler with the query on target.value', () => {
    let seen = '';
    const host = hostWith(
      { onKeyDown() {} },
      {
        onChange(event: { target: { value: string } }) {
          seen = event.target.value;
        },
      },
    );
    const result = applyWaypointQuery(host, 'Antares Station');
    expect(result.ok).toBe(true);
    expect(seen).toBe('Antares Station');
    expect(result.handlers).toEqual(['onKeyDown', 'onChange']);
  });

  it('reports the handler names when the field has no change callback', () => {
    const result = applyWaypointQuery(hostWith({ onKeyDown() {}, onBlur() {} }), 'Antares');
    expect(result.ok).toBe(false);
    expect(result.handlers).toEqual(['onKeyDown', 'onBlur']);
  });
});

import { describe, expect, it } from 'vitest';
import { rememberPlanetCxExchange, savedPlanetCxExchange } from './cx-exchange';

describe('savedPlanetCxExchange', () => {
  it('returns a stored exchange for that planet', () => {
    expect(savedPlanetCxExchange({ 'OT-580b': 'NC1' }, 'OT-580b')).toBe('NC1');
  });

  it('does not invent an exchange for a planet that has never been selected', () => {
    expect(savedPlanetCxExchange({}, 'OT-580b')).toBeUndefined();
    expect(savedPlanetCxExchange(undefined, 'OT-580b')).toBeUndefined();
    expect(savedPlanetCxExchange({ 'OT-580b': 'NC1' }, 'VH-331a')).toBeUndefined();
  });
});

describe('rememberPlanetCxExchange', () => {
  it('stores the chosen exchange for that planet', () => {
    const map: Record<string, string> = {};
    rememberPlanetCxExchange(map, 'OT-580b', 'NC1');
    expect(map['OT-580b']).toBe('NC1');
  });

  it('overwrites a previous choice for the same planet', () => {
    const map: Record<string, string> = { 'OT-580b': 'AI1' };
    rememberPlanetCxExchange(map, 'OT-580b', 'CI1');
    expect(map['OT-580b']).toBe('CI1');
  });

  it('does not write a default when no exchange was chosen', () => {
    const map: Record<string, string> = {};
    rememberPlanetCxExchange(map, 'OT-580b', undefined);
    rememberPlanetCxExchange(map, 'OT-580b', '');
    expect(map['OT-580b']).toBeUndefined();
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('leaves an existing choice alone when the new value is empty', () => {
    const map: Record<string, string> = { 'OT-580b': 'NC1' };
    rememberPlanetCxExchange(map, 'OT-580b', undefined);
    expect(map['OT-580b']).toBe('NC1');
  });
});

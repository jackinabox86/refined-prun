import { describe, expect, it } from 'vitest';
import { linkedMtraOrigin } from './cx-buy-origin';

describe('linkedMtraOrigin', () => {
  const resolve = (exchange: string) => `${exchange} Warehouse`;

  it('returns the CX warehouse origin when the buy exchange is set', () => {
    expect(linkedMtraOrigin(true, 'NC1', resolve)).toBe('NC1 Warehouse');
  });

  it('does not invent an origin when the buy exchange is unset', () => {
    expect(linkedMtraOrigin(true, undefined, resolve)).toBeUndefined();
    expect(linkedMtraOrigin(true, '', resolve)).toBeUndefined();
  });

  it('does not override a baked-in origin', () => {
    expect(linkedMtraOrigin(false, 'NC1', resolve)).toBeUndefined();
  });

  it('returns undefined when the warehouse cannot be resolved', () => {
    expect(linkedMtraOrigin(true, 'NC1', () => undefined)).toBeUndefined();
  });
});

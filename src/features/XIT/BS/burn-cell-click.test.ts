import { describe, expect, it } from 'vitest';
import { burnCellBufferCommand, toggleExpandedBurn } from './burn-cell-click';

describe('burnCellBufferCommand', () => {
  it('does not open a buffer on a plain click', () => {
    expect(burnCellBufferCommand({ shiftKey: false }, 'OT-580b')).toBeUndefined();
  });

  it('opens the base burn buffer on shift-click', () => {
    expect(burnCellBufferCommand({ shiftKey: true }, 'OT-580b')).toBe('XIT BURN OT-580b');
  });
});

describe('toggleExpandedBurn', () => {
  it('expands a collapsed base', () => {
    expect(toggleExpandedBurn([], 'OT-580b')).toEqual(['OT-580b']);
  });

  it('collapses an expanded base', () => {
    expect(toggleExpandedBurn(['OT-580b'], 'OT-580b')).toEqual([]);
  });

  it('leaves other expanded bases in place', () => {
    expect(toggleExpandedBurn(['UV-351a'], 'OT-580b')).toEqual(['UV-351a', 'OT-580b']);
  });
});

import { describe, expect, it } from 'vitest';
import { sfcCompanionCommand } from './shpi-sfc-companion-command';

describe('sfcCompanionCommand', () => {
  it('opens SFC for the same ship on shift-click', () => {
    expect(sfcCompanionCommand({ shiftKey: true }, 'SFC', 'AB-123')).toBe('SFC AB-123');
    expect(sfcCompanionCommand({ shiftKey: true }, 'SFC AB-123', 'AB-123')).toBe('SFC AB-123');
  });

  it('does not intercept a plain click', () => {
    expect(sfcCompanionCommand({ shiftKey: false }, 'SFC', 'AB-123')).toBeUndefined();
  });

  it('does not intercept INV or WAR', () => {
    expect(sfcCompanionCommand({ shiftKey: true }, 'INV OT-580b', 'AB-123')).toBeUndefined();
    expect(sfcCompanionCommand({ shiftKey: true }, 'WAR OT-580b', 'AB-123')).toBeUndefined();
  });

  it('does not intercept SHP or SHPF', () => {
    expect(sfcCompanionCommand({ shiftKey: true }, 'SHP', 'AB-123')).toBeUndefined();
    expect(sfcCompanionCommand({ shiftKey: true }, 'SHPF', 'AB-123')).toBeUndefined();
  });

  it('does not open without a registration', () => {
    expect(sfcCompanionCommand({ shiftKey: true }, 'SFC', undefined)).toBeUndefined();
    expect(sfcCompanionCommand({ shiftKey: true }, 'SFC', '')).toBeUndefined();
  });
});

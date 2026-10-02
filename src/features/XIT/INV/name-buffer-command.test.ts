import { describe, expect, it } from 'vitest';
import { invNameBufferCommand } from './name-buffer-command';

describe('invNameBufferCommand', () => {
  it('opens the base buffer for a base name', () => {
    expect(
      invNameBufferCommand({
        type: 'BASE',
        naturalId: 'OT-580b',
        inventoryCommand: 'INV abcdef01',
      }),
    ).toBe('BS OT-580b');
  });

  it('opens the ship buffer for a ship name', () => {
    expect(
      invNameBufferCommand({
        type: 'SHIP',
        registration: 'AB-123C',
        inventoryCommand: 'SHPI AB-123C',
      }),
    ).toBe('SHP AB-123C');
  });

  it('opens the exchange buffer by MIC for a commodity exchange name', () => {
    expect(
      invNameBufferCommand({
        type: 'CX',
        naturalId: 'MOR',
        exchangeCode: 'NC1',
        inventoryCommand: 'INV abcdef01',
      }),
    ).toBe('CX NC1');
  });

  it('keeps the inventory command for a warehouse name', () => {
    expect(
      invNameBufferCommand({
        type: 'WAREHOUSE',
        naturalId: 'OT-580b',
        inventoryCommand: 'INV abcdef01',
      }),
    ).toBe('INV abcdef01');
  });

  it('keeps the inventory command when an exchange MIC is missing', () => {
    expect(
      invNameBufferCommand({
        type: 'CX',
        naturalId: 'MOR',
        inventoryCommand: 'INV abcdef01',
      }),
    ).toBe('INV abcdef01');
  });
});

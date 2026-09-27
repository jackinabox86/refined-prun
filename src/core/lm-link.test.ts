import { describe, expect, it } from 'vitest';
import { lmBufferCommand } from './lm-link';

describe('lmBufferCommand', () => {
  it('opens LM with the location natural id', () => {
    expect(lmBufferCommand('OT-580b')).toBe('LM OT-580b');
    expect(lmBufferCommand('HRT')).toBe('LM HRT');
  });
});

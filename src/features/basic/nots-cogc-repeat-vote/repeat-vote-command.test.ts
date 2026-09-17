import { describe, expect, it } from 'vitest';
import { cogcRepeatVoteCommand } from './repeat-vote-command';

function planetAddress(naturalId: string): PrunApi.Address {
  return {
    lines: [
      { type: 'SYSTEM', entity: { id: 'sys', naturalId: 'LE', name: 'Leviatha' } },
      { type: 'PLANET', entity: { id: 'plt', naturalId, name: naturalId } },
    ],
  };
}

function alert(overrides: Partial<PrunApi.Alert> = {}): PrunApi.Alert {
  return {
    id: 'alert-1',
    type: 'COGC_PROGRAM_CHANGED',
    contextId: 'ctx',
    naturalId: '',
    time: { timestamp: 0 },
    data: [],
    seen: false,
    read: false,
    ...overrides,
  };
}

describe('cogcRepeatVoteCommand', () => {
  it('builds COGCPD p-{planet} pn-{program} from alert planet+program', () => {
    expect(
      cogcRepeatVoteCommand(
        alert({
          data: [
            { key: 'planet', value: { address: planetAddress('LE-137c') } },
            { key: 'program', value: 'ADVERTISING_ELECTRONICS' },
          ],
        }),
      ),
    ).toBe('COGCPD p-LE-137c pn-ADVERTISING_ELECTRONICS');
  });

  it('falls back to alert.naturalId when planet data is absent', () => {
    expect(
      cogcRepeatVoteCommand(
        alert({
          naturalId: 'OT-580b',
          data: [{ key: 'program', value: 'WORKFORCE_PIONEERS' }],
        }),
      ),
    ).toBe('COGCPD p-OT-580b pn-WORKFORCE_PIONEERS');
  });

  it('does not prefix values that already carry p-/pn-', () => {
    expect(
      cogcRepeatVoteCommand(
        alert({
          data: [
            { key: 'planet', value: { address: planetAddress('p-LE-137c') } },
            { key: 'program', value: 'pn-ADVERTISING_ELECTRONICS' },
          ],
        }),
      ),
    ).toBe('COGCPD p-LE-137c pn-ADVERTISING_ELECTRONICS');
  });

  it('does not return a command for other alert types', () => {
    expect(
      cogcRepeatVoteCommand(
        alert({
          type: 'COGC_STATUS_CHANGED',
          data: [
            { key: 'planet', value: { address: planetAddress('LE-137c') } },
            { key: 'program', value: 'ADVERTISING_ELECTRONICS' },
          ],
        }),
      ),
    ).toBeUndefined();
  });

  it('does not return a command when planet is missing', () => {
    expect(
      cogcRepeatVoteCommand(
        alert({ data: [{ key: 'program', value: 'ADVERTISING_ELECTRONICS' }] }),
      ),
    ).toBeUndefined();
  });

  it('does not return a command when program is missing', () => {
    expect(
      cogcRepeatVoteCommand(
        alert({
          data: [{ key: 'planet', value: { address: planetAddress('LE-137c') } }],
        }),
      ),
    ).toBeUndefined();
  });
});

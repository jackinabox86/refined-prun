import { describe, expect, it, vi } from 'vitest';

interface ClientMessage {
  messageType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

const mocks = vi.hoisted(() => ({
  dispatchClientPrunMessage: vi.fn<(message: { messageType: string; payload: unknown }) => boolean>(
    () => true,
  ),
}));
vi.mock('@src/infrastructure/prun-api/prun-api-listener', () => ({
  dispatchClientPrunMessage: mocks.dispatchClientPrunMessage,
}));
// The module graph reaches shell/config, which reads `document` at import time.
vi.mock('@src/infrastructure/shell/config', () => ({ default: {} }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).document = { body: { clientWidth: 1920, clientHeight: 1080 } };

import {
  rememberSplitOwner,
  resizeSplitWindow,
  splitOwnerId,
} from '@src/infrastructure/prun-ui/companion-buffer';

function fakeWindow() {
  return { nodeType: 1 } as unknown as Element;
}

describe('split owner registry', () => {
  it('returns the id recorded for that window', () => {
    const windowEl = fakeWindow();
    rememberSplitOwner(windowEl, '3');
    expect(splitOwnerId(windowEl)).toBe('3');
  });

  it('keeps windows separate and reports nothing for an unsplit or missing window', () => {
    const split = fakeWindow();
    rememberSplitOwner(split, '7');
    expect(splitOwnerId(fakeWindow())).toBeUndefined();
    expect(splitOwnerId(null)).toBeUndefined();
    expect(splitOwnerId(undefined)).toBeUndefined();
    expect(splitOwnerId(split)).toBe('7');
  });

  // The id space is the trap this registry exists for: a floating buffer's
  // data-prun-id is a small integer, while tilesStore is keyed by server UUIDs.
  it('stores the buffer id verbatim rather than any store key', () => {
    const windowEl = fakeWindow();
    rememberSplitOwner(windowEl, '12');
    expect(splitOwnerId(windowEl)).toBe('12');
  });
});

describe('resizeSplitWindow', () => {
  it('sizes the window and then moves the divider, on the owner id', async () => {
    mocks.dispatchClientPrunMessage.mockClear();
    await resizeSplitWindow('3', 320, 520, 600);
    const calls = mocks.dispatchClientPrunMessage.mock.calls.map(c => c[0] as ClientMessage);
    expect(calls.map(m => m.messageType)).toEqual([
      'UI_WINDOWS_UPDATE_SIZE',
      'UI_TILES_CHANGE_SIZE',
    ]);
    expect(calls[0]).toMatchObject({ payload: { id: '3', size: { width: 840, height: 600 } } });
    expect(calls[1]).toMatchObject({ payload: { id: '3', newDividerPosition: 320 / 840 } });
  });

  it('gives the panes unequal width', async () => {
    mocks.dispatchClientPrunMessage.mockClear();
    await resizeSplitWindow('3', 320, 630, 600);
    const divider = mocks.dispatchClientPrunMessage.mock.calls
      .map(c => c[0] as ClientMessage)
      .find(m => m.messageType === 'UI_TILES_CHANGE_SIZE');
    expect(divider?.payload.newDividerPosition).toBeLessThan(0.5);
  });
});

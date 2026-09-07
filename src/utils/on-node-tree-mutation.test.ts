import { beforeAll, describe, expect, it } from 'vitest';

// Landed from the JAC-25 R10 probe. Stubs MutationObserver — no jsdom.
let onNodeTreeMutation: typeof import('@src/utils/on-node-tree-mutation').onNodeTreeMutation;
const observers: FakeObserver[] = [];

class FakeObserver {
  connected = false;
  cb: (m: unknown[]) => void;
  constructor(cb: (m: unknown[]) => void) {
    this.cb = cb;
    observers.push(this);
  }
  observe() {
    this.connected = true;
  }
  disconnect() {
    this.connected = false;
  }
}

beforeAll(async () => {
  (globalThis as Record<string, unknown>).MutationObserver = FakeObserver;
  ({ onNodeTreeMutation } = await import('@src/utils/on-node-tree-mutation'));
});

function live() {
  return observers.filter(o => o.connected);
}

// Drive the newest connected observer and let the microtask flush run.
async function fire() {
  const o = live().at(-1);
  o?.cb([{ addedNodes: [], removedNodes: [] }]);
  await new Promise(r => setTimeout(r, 0));
}

describe('onNodeTreeMutation unsubscribe (R7)', () => {
  it('unsubscribing one callback leaves the others running', async () => {
    const node = {} as Node;
    const log: string[] = [];
    const stopA = onNodeTreeMutation(node, () => void log.push('A'));
    onNodeTreeMutation(node, () => void log.push('B'));
    await fire();
    expect(log).toEqual(['A', 'B']);
    stopA();
    await fire();
    expect(log).toEqual(['A', 'B', 'B']);
  });

  it('disconnects the observer only when the last callback goes', async () => {
    const node = {} as Node;
    const stopA = onNodeTreeMutation(node, () => {});
    const stopB = onNodeTreeMutation(node, () => {});
    const observer = live().at(-1)!;
    stopA();
    expect(observer.connected).toBe(true);
    stopB();
    expect(observer.connected).toBe(false);
  });

  it('is idempotent and does not evict a later callback on a second call', async () => {
    const node = {} as Node;
    const log: string[] = [];
    const stopA = onNodeTreeMutation(node, () => void log.push('A'));
    stopA();
    stopA();
    onNodeTreeMutation(node, () => void log.push('B'));
    await fire();
    expect(log).toEqual(['B']);
  });

  it('re-registers a working observer after the node was fully drained', async () => {
    const node = {} as Node;
    const log: string[] = [];
    onNodeTreeMutation(node, () => void log.push('A'))();
    onNodeTreeMutation(node, () => void log.push('B'));
    await fire();
    expect(log).toEqual(['B']);
  });

  it('unsubscribing after the callback self-removed via true is harmless', async () => {
    const node = {} as Node;
    const log: string[] = [];
    const stopA = onNodeTreeMutation(node, () => {
      log.push('A');
      return true;
    });
    const stopB = onNodeTreeMutation(node, () => void log.push('B'));
    await fire();
    expect(log).toEqual(['A', 'B']);
    // Feature calls this after the watcher already returned true.
    stopA();
    await fire();
    expect(log).toEqual(['A', 'B', 'B']);
    stopB();
  });

  it('a throwing callback does not remove the surviving callback', async () => {
    const node = {} as Node;
    const log: string[] = [];
    onNodeTreeMutation(node, () => {
      throw new Error('probe');
    });
    onNodeTreeMutation(node, () => void log.push('B'));
    await fire();
    await fire();
    expect(log).toEqual(['B', 'B']);
  });
});

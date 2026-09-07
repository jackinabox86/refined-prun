import { oneMicrotask } from '@src/utils/one-microtask';

type MutationCallback = (mutations: MutationRecord[]) => boolean | void;

const callbackMap = new WeakMap<Node, MutationCallback[]>();
const observerMap = new WeakMap<Node, MutationObserver>();
const removed = new Set<MutationCallback>();

const pendingProcessors = new Set<() => void>();

const flush = oneMicrotask(() => {
  const processors = Array.from(pendingProcessors);
  pendingProcessors.clear();
  for (const process of processors) {
    process();
  }
});

export function onNodeTreeMutation(
  node: Node,
  callback: MutationCallback,
  observeClass: boolean = false,
) {
  const callbacks = callbackMap.get(node) ?? [];
  if (callbacks.length === 0) {
    callbackMap.set(node, callbacks);
    let pending: MutationRecord[] = [];
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        pending.push(mutation);
      }
      pendingProcessors.add(process);
      flush();
    });
    const process = () => {
      const mutations = pending;
      pending = [];
      for (const callback of callbacks) {
        try {
          if (callback(mutations)) {
            removed.add(callback);
          }
        } catch (e) {
          console.error(e);
          removed.add(callback);
        }
      }
      if (removed.size > 0) {
        for (let i = callbacks.length - 1; i >= 0; i--) {
          if (removed.has(callbacks[i])) {
            callbacks.splice(i, 1);
          }
        }
        if (callbacks.length === 0) {
          callbackMap.delete(node);
          observer.disconnect();
          observerMap.delete(node);
        }
      }
      removed.clear();
    };
    const options: MutationObserverInit = {
      childList: true,
      subtree: true,
    };
    if (observeClass) {
      options.attributeFilter = ['class'];
    }
    observerMap.set(node, observer);
    observer.observe(node, options);
  }
  callbacks.push(callback);
  return () => {
    const current = callbackMap.get(node);
    if (current === undefined) {
      return;
    }
    const index = current.indexOf(callback);
    if (index === -1) {
      return;
    }
    current.splice(index, 1);
    if (current.length === 0) {
      callbackMap.delete(node);
      observerMap.get(node)?.disconnect();
      observerMap.delete(node);
    }
  };
}

// A fresh route field ignores synthetic input events. The component's own
// handler is what starts the address lookup. Value callbacks take the query
// string. Event callbacks read target.value and throw on a string, so the
// second call is the event.

interface FiberNode {
  memoizedProps?: unknown;
  return?: unknown;
}

export interface WaypointQueryCall {
  ok: boolean;
  handlers: string[];
}

function readHandlers(host: object) {
  const record = host as Record<string, unknown>;
  const fiberKey = Object.getOwnPropertyNames(record).find(name =>
    name.startsWith('__reactFiber$'),
  );
  let fiber = fiberKey === undefined ? undefined : record[fiberKey];
  let onChange: ((value: unknown) => void) | undefined;
  let onFocus: ((value: unknown) => void) | undefined;
  let onInput: ((value: unknown) => void) | undefined;
  const handlers: string[] = [];
  for (let depth = 0; depth < 8 && fiber !== null && typeof fiber === 'object'; depth += 1) {
    const props = (fiber as FiberNode).memoizedProps;
    if (props !== null && typeof props === 'object') {
      const bag = props as Record<string, unknown>;
      for (const name of Object.keys(bag)) {
        if (!name.startsWith('on') || typeof bag[name] !== 'function' || handlers.includes(name)) {
          continue;
        }
        handlers.push(name);
      }
      if (onChange === undefined && typeof bag.onChange === 'function') {
        onChange = bag.onChange as (value: unknown) => void;
      }
      if (onFocus === undefined && typeof bag.onFocus === 'function') {
        onFocus = bag.onFocus as (value: unknown) => void;
      }
      if (onInput === undefined && typeof bag.onInput === 'function') {
        onInput = bag.onInput as (value: unknown) => void;
      }
    }
    fiber = (fiber as FiberNode).return;
  }
  return { onChange, onFocus, onInput, handlers };
}

function writeQuery(host: object, query: string): void {
  if (typeof HTMLInputElement !== 'undefined' && host instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter !== undefined) {
      setter.call(host, query);
      return;
    }
  }
  (host as { value: string }).value = query;
}

function queryEvent(host: object, query: string) {
  return {
    target: host,
    currentTarget: host,
    preventDefault() {},
    stopPropagation() {},
    persist() {},
    nativeEvent: { isTrusted: true, data: query, target: host },
  };
}

function callWithQuery(handler: (value: unknown) => void, host: object, query: string): boolean {
  try {
    handler(query);
    return true;
  } catch {
    // The handler reads the event, not the string.
  }
  try {
    handler(queryEvent(host, query));
    return true;
  } catch {
    return false;
  }
}

export function applyWaypointQuery(host: object, query: string): WaypointQueryCall {
  const found = readHandlers(host);
  const onChange = found.onChange ?? found.onInput;
  if (onChange === undefined) {
    return { ok: false, handlers: found.handlers };
  }
  writeQuery(host, query);
  if (found.onFocus !== undefined) {
    callWithQuery(found.onFocus, host, query);
  }
  const changed = callWithQuery(onChange, host, query);
  return { ok: changed, handlers: found.handlers };
}

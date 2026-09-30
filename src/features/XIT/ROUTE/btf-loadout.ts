import { L } from '@src/infrastructure/prun-ui/i18n';
import { changeSelectIndex, clickElement } from '@src/util';
import { waitFor } from '@src/utils/wait-for';
import {
  LoadoutSlider,
  matchingFieldLabel,
  sliderNudgeLimit,
  sliderTarget,
  tankKind,
} from '@src/features/XIT/ROUTE/tank-level';

export interface ConfirmedLoadout {
  sliders: LoadoutSlider[];
  selectValue: string | undefined;
  gatewayOn: boolean | undefined;
  priorStl: number[];
  priorFtl: number[];
}

export const confirmedLoadout = {
  current: undefined as ConfirmedLoadout | undefined,
  reset() {
    this.current = undefined;
  },
};

export function captureLoadout(
  anchor: Element,
): { ok: true; loadout: ConfirmedLoadout } | { ok: false; error: string } {
  const labels = fieldLabels();
  const stlLabel = L.BlueprintTestFlight.label.stlFuel() ?? '';
  const ftlLabel = L.BlueprintTestFlight.label.ftlFuel() ?? '';
  if (stlLabel.length === 0) {
    return { ok: false, error: 'STL fuel label is not loaded' };
  }
  const sliders: LoadoutSlider[] = [];
  for (const slider of _$$(anchor, 'rc-slider')) {
    const handle = sliderHandle(slider);
    const now = handle === undefined ? undefined : readNow(handle);
    if (handle === undefined || now === undefined) {
      return { ok: false, error: 'a loadout slider has no value' };
    }
    const label = matchingFieldLabel(ancestorTexts(slider), labels);
    if (label === undefined) {
      return { ok: false, error: 'a loadout slider has no label' };
    }
    sliders.push({ label, value: now, tank: tankKind(label, stlLabel, ftlLabel) });
  }
  if (!sliders.some(x => x.tank === 'stl')) {
    return { ok: false, error: 'STL fuel slider is not on the test flight' };
  }
  const select = anchor.querySelector('select');
  const gateway = select === null ? undefined : gatewayToggle(select);
  return {
    ok: true,
    loadout: {
      sliders,
      selectValue: select === null ? undefined : select.value,
      gatewayOn: gateway === undefined ? undefined : gatewayOn(gateway),
      priorStl: [],
      priorFtl: [],
    },
  };
}

export async function applyConfirmedLoadout(anchor: Element, loadout: ConfirmedLoadout) {
  const select = anchor.querySelector('select');
  if (
    select !== null &&
    loadout.selectValue !== undefined &&
    select.value !== loadout.selectValue
  ) {
    const index = Array.from(select.options).findIndex(
      option => option.value === loadout.selectValue,
    );
    if (index < 0) {
      return 'FTL preference is not on the test flight';
    }
    changeSelectIndex(select, index);
  }
  if (select !== null && loadout.gatewayOn !== undefined) {
    const gateway = gatewayToggle(select);
    if (gateway === undefined) {
      return 'gateway toggle is not on the test flight';
    }
    if (gatewayOn(gateway) !== loadout.gatewayOn) {
      await clickElement(gateway);
    }
  }
  const labels = fieldLabels();
  const stlLabel = L.BlueprintTestFlight.label.stlFuel() ?? '';
  const ftlLabel = L.BlueprintTestFlight.label.ftlFuel() ?? '';
  const ordered = [
    ...loadout.sliders.filter(x => x.tank === undefined),
    ...loadout.sliders.filter(x => x.tank !== undefined),
  ];
  const findSliders = () => {
    const byLabel = new Map<string, Element>();
    for (const slider of _$$(anchor, 'rc-slider')) {
      const label = matchingFieldLabel(ancestorTexts(slider), labels);
      if (label !== undefined) {
        byLabel.set(label, slider);
      }
    }
    return byLabel;
  };
  // The destination change rebuilds the form. The sliders are not back yet
  // when the address click returns.
  let byLabel = findSliders();
  const present = await waitFor(() => {
    byLabel = findSliders();
    return ordered.every(saved => byLabel.has(saved.label));
  }, 5000);
  if (!present) {
    const missing = ordered.find(saved => !byLabel.has(saved.label));
    return `${missing?.label ?? 'loadout'} slider is not on the test flight`;
  }
  for (const saved of ordered) {
    const slider = byLabel.get(saved.label);
    if (slider === undefined) {
      return `${saved.label} slider is not on the test flight`;
    }
    const target = sliderTarget(
      { ...saved, tank: tankKind(saved.label, stlLabel, ftlLabel) },
      loadout.priorStl,
      loadout.priorFtl,
    );
    const set = await setSliderTo(slider, target);
    if (!set.ok) {
      const at = set.now === undefined ? 'no value' : String(set.now);
      const arrow = set.arrowMoved ? '' : ', arrow did not move it';
      const handler = set.handler === false ? ', no key handler' : '';
      const change = set.change ? ', change handler missed' : ', no change handler';
      return `could not set ${saved.label} to ${target} (now ${at}${arrow}${handler}${change})`;
    }
  }
  return undefined;
}

// The address change rewrites the sliders after a write. Read them again at
// the moment the plan is accepted, and refuse a plan whose tanks are not the
// levels that leg was supposed to fly.
export function tankLevelsAtTarget(anchor: Element, loadout: ConfirmedLoadout) {
  const labels = fieldLabels();
  const stlLabel = L.BlueprintTestFlight.label.stlFuel() ?? '';
  const ftlLabel = L.BlueprintTestFlight.label.ftlFuel() ?? '';
  const live = new Map<string, number | undefined>();
  for (const slider of _$$(anchor, 'rc-slider')) {
    const label = matchingFieldLabel(ancestorTexts(slider), labels);
    if (label === undefined) {
      continue;
    }
    const handle = sliderHandle(slider);
    live.set(label, handle === undefined ? undefined : readNow(handle));
  }
  for (const kind of ['stl', 'ftl'] as const) {
    const saved = loadout.sliders.find(
      slider => tankKind(slider.label, stlLabel, ftlLabel) === kind,
    );
    const name = kind === 'stl' ? stlLabel || 'STL Fuel' : ftlLabel || 'FTL fuel';
    if (saved === undefined) {
      return `${name} was not confirmed`;
    }
    const now = live.get(saved.label);
    const target = sliderTarget({ ...saved, tank: kind }, loadout.priorStl, loadout.priorFtl);
    if (now !== target) {
      const at = now === undefined ? 'no value' : String(now);
      return `${saved.label} is ${at}, expected ${target}`;
    }
  }
  return undefined;
}

// Set the tank through the slider's own change handler. The route pane's
// track is 103px for 0..3500, so a pointer cannot land on every unit, and a
// constructed key event reports keyCode 0. The handler takes the unit directly.
async function setSliderTo(slider: Element, target: number) {
  const handle = sliderHandle(slider);
  if (handle === undefined) {
    return { ok: false, now: undefined, arrowMoved: false, handler: false, change: false };
  }
  const min = Number(handle.getAttribute('aria-valuemin'));
  const max = Number(handle.getAttribute('aria-valuemax'));
  if (!Number.isFinite(min) || !Number.isFinite(max) || target < min || target > max) {
    return { ok: false, now: readNow(handle), arrowMoved: false, handler: false, change: false };
  }
  const current = readNow(handle);
  if (current === target) {
    return { ok: true };
  }
  const onChange = sliderOnChange(handle);
  const change = onChange !== undefined;
  if (onChange !== undefined) {
    try {
      onChange(target);
    } catch {
      // The slider rejected the value. The arrow steps below are the fallback.
    }
    if (await waitFor(() => readNow(handle) === target, 1000)) {
      return { ok: true };
    }
  }
  const rect = slider.getBoundingClientRect();
  const span = max - min;
  const limit = sliderNudgeLimit(span, rect.width);
  if (limit === undefined || span === 0) {
    return { ok: false, now: current, arrowMoved: false, handler: false, change };
  }
  let now = readNow(handle);
  let guard = 0;
  let arrowMoved = false;
  let handler = false;
  while (now !== target && now !== undefined && guard < limit) {
    const before = now;
    if (pressSliderKey(handle, now < target ? 'ArrowRight' : 'ArrowLeft')) {
      handler = true;
    }
    const moved = await waitFor(() => readNow(handle) !== before, 500);
    if (!moved) {
      return { ok: false, now, arrowMoved, handler, change };
    }
    arrowMoved = true;
    now = readNow(handle);
    guard += 1;
  }
  if (now === target) {
    return { ok: true };
  }
  return { ok: false, now, arrowMoved, handler, change };
}

function fieldLabels() {
  const label = L.BlueprintTestFlight.label;
  return [
    label.fuelUsage(),
    label.payload(),
    label.stlFuel(),
    label.ftlFuel(),
    label.condition(),
  ].filter((x): x is string => x !== undefined && x.length > 0);
}

function ancestorTexts(slider: Element) {
  const texts: string[] = [];
  let node = slider.parentElement;
  while (node !== null && texts.length < 6) {
    texts.push(node.textContent ?? '');
    node = node.parentElement;
  }
  return texts;
}

function sliderHandle(slider: Element) {
  const handle = _$(slider, 'rc-slider-handle');
  if (handle instanceof HTMLElement) {
    return handle;
  }
  return undefined;
}

function readNow(handle: HTMLElement) {
  const value = Number(handle.getAttribute('aria-valuenow'));
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function sliderOnChange(handle: HTMLElement) {
  const record = handle as unknown as Record<string, unknown>;
  const fiberKey = Object.getOwnPropertyNames(record).find(name =>
    name.startsWith('__reactFiber$'),
  );
  let fiber = fiberKey === undefined ? undefined : record[fiberKey];
  for (let depth = 0; depth < 12 && fiber !== null && typeof fiber === 'object'; depth += 1) {
    const props = (fiber as { memoizedProps?: unknown }).memoizedProps;
    if (
      props !== null &&
      typeof props === 'object' &&
      'min' in props &&
      'max' in props &&
      typeof (props as { onChange?: unknown }).onChange === 'function'
    ) {
      return (props as unknown as { onChange: (value: number) => void }).onChange;
    }
    fiber = (fiber as { return?: unknown }).return;
  }
  return undefined;
}

function pressSliderKey(handle: HTMLElement, key: 'ArrowLeft' | 'ArrowRight') {
  const keyCode = key === 'ArrowLeft' ? 37 : 39;
  const event = {
    key,
    code: key,
    keyCode,
    which: keyCode,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault() {},
    stopPropagation() {},
    persist() {},
    getModifierState() {
      return false;
    },
    nativeEvent: { key, code: key, keyCode, which: keyCode },
  };
  const onKeyDown = findKeyDown(handle);
  if (onKeyDown !== undefined) {
    try {
      onKeyDown(event);
      return true;
    } catch {
      // The handler wanted a real event. The keyboard event below is the fallback.
    }
  }
  handle.focus();
  const keyboard = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
  });
  // A constructed event reports keyCode 0. Own getters shadow that so a
  // handler that still reads keyCode sees the arrow.
  try {
    Object.defineProperty(keyboard, 'keyCode', { get: () => keyCode });
    Object.defineProperty(keyboard, 'which', { get: () => keyCode });
  } catch {
    // KeyCode is not configurable here. Dispatch the event as constructed.
  }
  handle.dispatchEvent(keyboard);
  return false;
}

function findKeyDown(handle: HTMLElement) {
  let node: HTMLElement | null = handle;
  for (let depth = 0; depth < 4 && node !== null; depth += 1) {
    const record = node as unknown as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(record)) {
      if (!name.startsWith('__reactProps$') && !name.startsWith('__reactFiber$')) {
        continue;
      }
      const owner = record[name];
      const props =
        owner !== null && typeof owner === 'object' && 'memoizedProps' in owner
          ? (owner as { memoizedProps?: unknown }).memoizedProps
          : owner;
      if (props !== null && typeof props === 'object' && 'onKeyDown' in props) {
        const handler = (props as { onKeyDown?: unknown }).onKeyDown;
        if (typeof handler === 'function') {
          return handler as (event: object) => void;
        }
      }
    }
    node = node.parentElement;
  }
  return undefined;
}

function gatewayToggle(select: HTMLSelectElement) {
  let node: Element | null = select.parentElement;
  while (node !== null) {
    const leaves = Array.from(node.querySelectorAll<HTMLElement>('[class*=Check]')).filter(el => {
      if (el.contains(select) || select.contains(el)) {
        return false;
      }
      const text = (el.textContent ?? '').trim();
      if (text.length === 0 || text.length > 48) {
        return false;
      }
      return !Array.from(el.children).some(child => (child.textContent ?? '').trim() === text);
    });
    const leaf = leaves[0];
    if (leaf !== undefined) {
      return leaf;
    }
    node = node.parentElement;
  }
  return undefined;
}

function gatewayOn(el: HTMLElement) {
  let node: HTMLElement | null = el;
  for (let depth = 0; depth < 4 && node !== null; depth += 1) {
    const aria = node.getAttribute('aria-checked') ?? node.getAttribute('aria-pressed');
    if (aria === 'true') {
      return true;
    }
    if (aria === 'false') {
      return false;
    }
    if (/active/i.test(node.className) && /check/i.test(node.className)) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

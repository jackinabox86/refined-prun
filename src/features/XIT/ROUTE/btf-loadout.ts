import { L } from '@src/infrastructure/prun-ui/i18n';
import { changeSelectIndex, clickElement } from '@src/util';
import { sleep } from '@src/utils/sleep';
import { waitFor } from '@src/utils/wait-for';
import {
  LoadoutSlider,
  matchingFieldLabel,
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
  const byLabel = new Map<string, Element>();
  for (const slider of _$$(anchor, 'rc-slider')) {
    const label = matchingFieldLabel(ancestorTexts(slider), labels);
    if (label !== undefined) {
      byLabel.set(label, slider);
    }
  }
  const ordered = [
    ...loadout.sliders.filter(x => x.tank === undefined),
    ...loadout.sliders.filter(x => x.tank !== undefined),
  ];
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
    if (!set) {
      return `could not set ${saved.label} to ${target}`;
    }
  }
  return undefined;
}

// A pointer aims the handle, then arrow keys correct the unit the pixel grid cannot land.
// Live on BP-STRT-0000: the STL track is 378px for 0..1500, a drag landed one unit off,
// and one ArrowRight moved aria-valuenow by exactly 1.
async function setSliderTo(slider: Element, target: number) {
  const handle = sliderHandle(slider);
  if (handle === undefined) {
    return false;
  }
  const min = Number(handle.getAttribute('aria-valuemin'));
  const max = Number(handle.getAttribute('aria-valuemax'));
  if (!Number.isFinite(min) || !Number.isFinite(max) || target < min || target > max) {
    return false;
  }
  const current = readNow(handle);
  if (current === target) {
    return true;
  }
  const rect = slider.getBoundingClientRect();
  const span = max - min;
  const ratio = span === 0 ? 0 : (target - min) / span;
  const clientX = rect.left + ratio * rect.width;
  const clientY = rect.top + rect.height / 2;
  slider.dispatchEvent(mouseAt('mousedown', clientX, clientY));
  await sleep(0);
  document.dispatchEvent(mouseAt('mousemove', clientX, clientY));
  await sleep(0);
  document.dispatchEvent(mouseAt('mouseup', clientX, clientY));
  let now = current;
  await waitFor(() => {
    now = readNow(handle);
    return now !== current;
  }, 1000);
  let guard = 0;
  while (now !== target && now !== undefined && guard < 6) {
    const before = now;
    const key = now < target ? 'ArrowRight' : 'ArrowLeft';
    handle.focus();
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }),
    );
    const moved = await waitFor(() => readNow(handle) !== before, 500);
    if (!moved) {
      return false;
    }
    now = readNow(handle);
    guard += 1;
  }
  return now === target;
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

function mouseAt(type: 'mousedown' | 'mousemove' | 'mouseup', clientX: number, clientY: number) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: type === 'mouseup' ? 0 : 1,
  });
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

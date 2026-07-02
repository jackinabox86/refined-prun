import {
  changeInputValue,
  clickElement,
  focusElement,
  selectMaterialInMaterialSelector,
} from '@src/util';
import { sleep } from '@src/utils/sleep';
import PrunButton from '@src/components/PrunButton.vue';
import $style from './contd-json-paste-import.module.css';

interface SupplyCartJson {
  groups?: Array<{ name?: string; materials?: Record<string, number> }>;
}

interface MaterialEntry {
  ticker: string;
  amount: number;
  price?: number;
}

interface ParseResult {
  error?: string;
  groupCount?: number;
  skipped?: number;
  materials: MaterialEntry[];
}

function parseSupplyCart(json: string): ParseResult {
  if (json.trim() === '') {
    return { materials: [] };
  }

  let data: SupplyCartJson;
  try {
    data = JSON.parse(json);
  } catch {
    return { error: 'Invalid JSON.', materials: [] };
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];
  if (groups.length === 0) {
    return { error: 'No material groups found.', materials: [] };
  }

  const materials = groups.flatMap(group =>
    Object.entries(group.materials ?? {}).map(([ticker, amount]) => ({ ticker, amount })),
  );

  return { groupCount: groups.length, materials };
}

function summarizeSupplyCart(result: ParseResult): string {
  if (result.error) {
    return result.error;
  }
  if (result.groupCount === undefined) {
    return '';
  }
  const { groupCount, materials } = result;
  return `Parsed ${groupCount} group${groupCount === 1 ? '' : 's'}, ${materials.length} material${materials.length === 1 ? '' : 's'}.`;
}

// Sheets/Excel rows paste as tab-separated columns: amount, ticker, price.
// Rows that don't parse (e.g. a pasted header row like "Amount Material Price")
// are skipped rather than failing the whole paste.
function parseSheetsExcel(text: string): ParseResult {
  if (text.trim() === '') {
    return { materials: [] };
  }

  const materials: MaterialEntry[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      continue;
    }

    const [amountCol, tickerCol, priceCol] = line.split('\t');
    const amount = Number(amountCol?.trim());
    const ticker = tickerCol?.trim().toUpperCase();
    if (!ticker || !Number.isFinite(amount)) {
      skipped++;
      continue;
    }

    const priceText = priceCol?.trim();
    const parsedPrice = priceText ? Number(priceText) : undefined;
    const price = Number.isFinite(parsedPrice) ? parsedPrice : undefined;

    materials.push({ ticker, amount, price });
  }

  if (materials.length === 0) {
    return { error: 'No material rows found.', materials: [] };
  }

  return { materials, skipped };
}

function summarizeSheetsExcel(result: ParseResult): string {
  if (result.error) {
    return result.error;
  }
  if (result.materials.length === 0) {
    return '';
  }
  const { materials, skipped } = result;
  const skippedText =
    skipped !== undefined && skipped > 0
      ? ` (${skipped} row${skipped === 1 ? '' : 's'} skipped)`
      : '';
  return `Parsed ${materials.length} material${materials.length === 1 ? '' : 's'}${skippedText}.`;
}

function findAddCommodityButton(anchor: Element) {
  return _$$(anchor, 'button').find(btn => {
    const t = btn.textContent?.trim().toLowerCase();
    return t === 'add commodity' || t === 'add shipment';
  }) as HTMLElement | undefined;
}

async function waitForGroupCount(anchor: Element, expected: number, timeout = 2000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (_$$(anchor, C.TemplateSelection.group).length >= expected) {
      return;
    }
    await sleep(50);
  }
}

// Adds/fills CONTD commodity rows from parsed input. Same job as addMaterials() in
// src/features/XIT/ACT/action-steps/cont-utils.ts (used by the ACT runner), kept
// separate here since that helper is coupled to ACT's ContDraftContext.
async function importMaterials(anchor: Element, materials: MaterialEntry[]) {
  for (let i = 0; i < materials.length; i++) {
    let groups = _$$(anchor, C.TemplateSelection.group);
    if (groups.length <= i) {
      await clickElement(findAddCommodityButton(anchor));
      await waitForGroupCount(anchor, i + 1);
      groups = _$$(anchor, C.TemplateSelection.group);
    }

    if (groups.length <= i) {
      continue;
    }
    const group = groups[i];
    const { ticker, amount, price } = materials[i];

    const amountInput = group.querySelector(
      'input[inputmode="numeric"]',
    ) as HTMLInputElement | null;
    if (amountInput) {
      focusElement(amountInput);
      changeInputValue(amountInput, String(amount));
    }

    if (price !== undefined) {
      const priceInput = group.querySelector(
        'input[inputmode="decimal"]',
      ) as HTMLInputElement | null;
      if (priceInput) {
        focusElement(priceInput);
        changeInputValue(priceInput, String(price));
      }
    }

    const materialSelectorContainer = _$(group, C.MaterialSelector.container);
    if (materialSelectorContainer) {
      await selectMaterialInMaterialSelector(materialSelectorContainer, ticker);
    }
  }
}

// --- Drag tab: dragging a material stack icon from another inventory in and
// dropping it here, mimicking the game's own inventory-transfer quantity picker.
//
// The game uses native HTML5 drag-and-drop (draggable="true" on the stack icon),
// but its dataTransfer payload isn't usable (the game calls setData with an
// unstringified object, so getData just returns "[object Object]"). So instead
// of reading the drag payload, a page-wide dragstart listener remembers which
// element started the drag — same technique prun-bugs.ts already uses to fix a
// text-selection bug during drag — and ticker/quantity are read directly off
// that element's own icon markup (C.ColoredIcon.label / C.MaterialIcon.indicator)
// once it's dropped here.
//
// Known limitation: the game supports ctrl-click-selecting multiple stacks and
// dragging them together; only one source element fires dragstart per gesture,
// so multi-stack-in-one-drag isn't recoverable here. Dropping stacks one at a
// time accumulates them in the list below instead.
let lastDragSource: Element | undefined;

function trackDragSource() {
  document.addEventListener(
    'dragstart',
    e => {
      lastDragSource = (e.target as Element).closest('[draggable="true"]') ?? undefined;
    },
    true,
  );
}

interface DraggedStack {
  ticker: string;
  quantity: number;
}

function getDraggedStack(): DraggedStack | undefined {
  const source = lastDragSource;
  if (!source) {
    return undefined;
  }
  const ticker = _$(source, C.ColoredIcon.label)?.textContent?.trim();
  const quantityText = _$(source, C.MaterialIcon.indicator)?.textContent?.trim();
  if (!ticker || !quantityText) {
    return undefined;
  }
  const quantity = Number(quantityText.replace(/,/g, ''));
  return Number.isFinite(quantity) ? { ticker, quantity } : undefined;
}

interface QuickAmount {
  label: string;
  amount: number;
}

// Mirrors the game's own AMT/1/10/100/HLF/ALL quick-transfer boxes — 10/100 only
// appear when the stack actually has that many units. AMT here defaults to the
// full stack; unlike the game's version it can't accept typed input mid-drag
// (a native drag blocks keyboard focus until it ends), so every dropped row's
// amount stays editable afterward in the list instead.
function quickAmounts(quantity: number): QuickAmount[] {
  const options: QuickAmount[] = [
    { label: 'AMT', amount: quantity },
    { label: '1', amount: 1 },
  ];
  if (quantity >= 10) {
    options.push({ label: '10', amount: 10 });
  }
  if (quantity >= 100) {
    options.push({ label: '100', amount: 100 });
  }
  options.push({ label: 'HLF', amount: Math.floor(quantity / 2) });
  options.push({ label: 'ALL', amount: quantity });
  return options;
}

interface ParserConfig {
  id: string;
  label: string;
  placeholder: string;
  parse: (text: string) => ParseResult;
  summarize: (result: ParseResult) => string;
}

// One tab per supported paste format. Add an entry here to support a new
// text-pasted source — each gets its own tab, textarea, and pasted-text state.
// The Drag tab (below) isn't text-driven, so it's wired up separately.
const parsers: ParserConfig[] = [
  {
    id: 'prunplanner',
    label: 'Prun Planner',
    placeholder: 'Paste PRUNplanner supply cart JSON (parsing only, for now)',
    parse: parseSupplyCart,
    summarize: summarizeSupplyCart,
  },
  {
    id: 'sheets',
    label: 'Sheets/Excel',
    placeholder: 'Paste rows copied from Sheets/Excel: amount, ticker, price (tab-separated)',
    parse: parseSheetsExcel,
    summarize: summarizeSheetsExcel,
  },
];

const dragTabId = 'drag';
const activeParserStorageKey = 'rprun-contd-json-paste-active';

function insertPasteBox(container: Element, anchor: Element) {
  // Storage returns null only when the key was never set (first-ever use) —
  // that's the one case that should default to open. A hidden state is stored
  // as '' rather than removed, so it round-trips instead of getting read back
  // as null and falling through to the default.
  const activeParser = ref(localStorage.getItem(activeParserStorageKey) ?? parsers[0].id);
  watch(activeParser, value => localStorage.setItem(activeParserStorageKey, value));

  const textInstances = parsers.map(parser => {
    const text = ref('');
    const parsed = computed(() => parser.parse(text.value));
    const status = computed(() => parser.summarize(parsed.value));
    const isInvalid = computed(() => parsed.value.error !== undefined);
    const canImport = computed(() => !parsed.value.error && parsed.value.materials.length > 0);
    const materials = computed(() => parsed.value.materials);
    return { kind: 'text' as const, ...parser, text, materials, status, isInvalid, canImport };
  });

  const dragMaterials = ref<MaterialEntry[]>([]);
  const dragHover = ref<DraggedStack | undefined>();
  const dragStatus = computed(() =>
    dragMaterials.value.length > 0
      ? `${dragMaterials.value.length} material${dragMaterials.value.length === 1 ? '' : 's'} ready.`
      : '',
  );
  const dragInstance = {
    kind: 'drag' as const,
    id: dragTabId,
    label: 'Drag',
    materials: computed(() => dragMaterials.value),
    status: dragStatus,
    isInvalid: computed(() => false),
    canImport: computed(() => dragMaterials.value.length > 0),
  };

  let dragDepth = 0;
  const onZoneDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragDepth++;
    dragHover.value ??= getDraggedStack();
  };
  const onZoneDragOver = (e: DragEvent) => e.preventDefault();
  const onZoneDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dragHover.value = undefined;
    }
  };
  const onZoneDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth = 0;
    dragHover.value = undefined;
  };
  const onOptionDrop = (e: DragEvent, option: QuickAmount) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth = 0;
    const stack = dragHover.value;
    dragHover.value = undefined;
    if (!stack || option.amount <= 0) {
      return;
    }
    dragMaterials.value.push({ ticker: stack.ticker, amount: option.amount });
  };

  const tabs = [...textInstances, dragInstance];
  const active = computed(() => tabs.find(tab => tab.id === activeParser.value));

  let importing = false;
  const onImport = async () => {
    const instance = active.value;
    if (!instance || importing || !instance.canImport.value) {
      return;
    }
    importing = true;
    try {
      await importMaterials(anchor, instance.materials.value);
    } finally {
      importing = false;
    }
  };

  createFragmentApp(() => {
    const instance = active.value;
    return (
      <div class={$style.container}>
        <div class={$style.tabRow}>
          {tabs.map(tab => (
            <PrunButton
              dark={activeParser.value !== tab.id}
              primary={activeParser.value === tab.id}
              inline
              onClick={() => (activeParser.value = tab.id)}>
              {tab.label}
            </PrunButton>
          ))}
          {instance && (
            <PrunButton dark inline onClick={() => (activeParser.value = '')}>
              Hide
            </PrunButton>
          )}
        </div>
        {instance?.kind === 'text' && (
          <textarea
            class={[C.TextareaInput.textarea, $style.textarea]}
            placeholder={instance.placeholder}
            value={instance.text.value}
            onInput={(e: Event) => (instance.text.value = (e.target as HTMLTextAreaElement).value)}
          />
        )}
        {instance?.kind === 'drag' && (
          <div
            class={[$style.dropZone, dragHover.value && $style.dropZoneHover]}
            onDragenter={onZoneDragEnter}
            onDragover={onZoneDragOver}
            onDragleave={onZoneDragLeave}
            onDrop={onZoneDrop}>
            {dragMaterials.value.length === 0 && !dragHover.value && (
              <div class={[$style.dropZoneHint, C.type.typeSmall]}>
                Drag a material stack here from another inventory
              </div>
            )}
            {dragMaterials.value.map((material, index) => (
              <div class={$style.materialRow}>
                <span class={[$style.materialTicker, C.type.typeSmall]}>{material.ticker}</span>
                <input
                  type="number"
                  class={$style.amountInput}
                  value={material.amount}
                  onInput={(e: Event) =>
                    (material.amount = Number((e.target as HTMLInputElement).value))
                  }
                />
                <PrunButton dark inline onClick={() => dragMaterials.value.splice(index, 1)}>
                  x
                </PrunButton>
              </div>
            ))}
            {dragHover.value && (
              <div class={$style.dropOverlay}>
                {quickAmounts(dragHover.value.quantity).map(option => (
                  <div
                    class={[C.DropTargetView.item, $style.overlayItem]}
                    onDragover={(e: DragEvent) => e.preventDefault()}
                    onDrop={(e: DragEvent) => onOptionDrop(e, option)}>
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {instance && (
          <div class={$style.row}>
            {instance.status.value && (
              <div
                class={[
                  $style.status,
                  C.type.typeSmall,
                  instance.isInvalid.value && C.colors.textDanger,
                ]}>
                {instance.status.value}
              </div>
            )}
            {instance.canImport.value && (
              <PrunButton dark inline onClick={onImport}>
                Import
              </PrunButton>
            )}
          </div>
        )}
      </div>
    );
  }).before(container);
}

function onTileReady(tile: PrunTile) {
  let inserted = false;
  subscribe($$(tile.anchor, C.TemplateSelection.container), container => {
    if (inserted) {
      return;
    }
    inserted = true;
    insertPasteBox(container, tile.anchor);
  });
}

function init() {
  trackDragSource();
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Adds a paste box at the top of the commodity template screen to import materials/amounts from PRUNplanner JSON, Sheets/Excel rows, or dragged material stacks.',
);

import PrunButton from '@src/components/PrunButton.vue';
import {
  ContractDraftSpec,
  MaterialEntry,
  ParseResult,
  parseContractJson,
  parseSheetsExcel,
  parseSupplyCart,
  specHasContractFields,
  summarizeContractJson,
  summarizeSheetsExcel,
  summarizeSupplyCart,
} from './parsers';
import {
  currentTemplateType,
  importMaterials,
  selectLocation,
  selectTemplateType,
  setAutoProvision,
  setCurrency,
  setDeadline,
  setShipPrice,
} from './draft-form';
import $style from './contd-paste-import.module.css';

// Fills the template panel from the spec, in dependency order: the template
// type first (switching it rebuilds the form), payment after the material
// rows (the division needs the final row count), auto-provision after the
// origin (its options populate only then). Fields the spec doesn't set stay
// untouched; fields that fail are collected and reported, the rest of the
// import continues. Server actions (apply template, cancel) are never clicked.
async function importSpec(anchor: Element, spec: ContractDraftSpec): Promise<string[]> {
  const issues: string[] = [];

  if (spec.type && !(await selectTemplateType(anchor, spec.type))) {
    issues.push(`template ${spec.type}`);
  }
  const isShip = currentTemplateType(anchor) === 'SHIP';

  if (spec.currency && !(await setCurrency(anchor, spec.currency))) {
    issues.push(`currency ${spec.currency}`);
  }

  await importMaterials(anchor, spec.materials);

  if (spec.payment !== undefined) {
    if (!isShip) {
      issues.push('payment (SHIP only)');
    } else if (!setShipPrice(anchor, spec.payment)) {
      issues.push('payment');
    }
  }

  const addresses = _$$(anchor, C.AddressSelector.container);
  const fillAddress = async (index: number, name: string, label: string) => {
    const address = addresses.at(index);
    if (!address || !(await selectLocation(address, name))) {
      issues.push(`${label} ${name}`);
    }
  };
  if (isShip) {
    if (spec.location) {
      issues.push('location (BUY/SELL only)');
    }
    if (spec.origin) {
      await fillAddress(0, spec.origin, 'origin');
    }
    if (spec.destination) {
      await fillAddress(1, spec.destination, 'destination');
    }
    if (spec.autoProvision && !(await setAutoProvision(anchor, spec.autoProvision))) {
      issues.push(`auto-provision ${spec.autoProvision}`);
    }
  } else {
    if (spec.origin || spec.destination) {
      issues.push('origin/destination (SHIP only)');
    }
    if (spec.autoProvision) {
      issues.push('auto-provision (SHIP only)');
    }
    if (spec.location) {
      await fillAddress(0, spec.location, 'location');
    }
  }

  if (spec.deadline !== undefined && !setDeadline(anchor, spec.deadline)) {
    issues.push('deadline');
  }

  return issues;
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

// Mirrors the game's own quick-transfer boxes (verified against the real
// inventory-transfer overlay): AMT first, then every power of ten up to the
// stack size, HLF, and ALL, sorted ascending by amount — for an 18-stack the
// game really shows HLF(9) *before* 10, and a 21,697-stack gets 1000 and
// 10000 boxes. Equal values aren't deduped (a 10-stack shows both 10 and
// ALL), also matching the game. AMT here defaults to the full stack; unlike
// the game's version it can't accept typed input mid-drag (a native drag
// blocks keyboard focus until it ends), so every dropped row's amount stays
// editable afterward in the list instead.
function quickAmounts(quantity: number): QuickAmount[] {
  const options: QuickAmount[] = [{ label: '1', amount: 1 }];
  for (let power = 10; power <= quantity; power *= 10) {
    options.push({ label: String(power), amount: power });
  }
  options.push({ label: 'HLF', amount: Math.floor(quantity / 2) });
  options.push({ label: 'ALL', amount: quantity });
  const sorted = options.filter(option => option.amount >= 1).sort((a, b) => a.amount - b.amount);
  return [{ label: 'AMT', amount: quantity }, ...sorted];
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
    id: 'json',
    label: 'JSON',
    placeholder:
      'Paste contract JSON, e.g. {"type": "SHIP", "currency": "NCC", "origin": "Montem", ' +
      '"destination": "Moria Station", "payment": 10000, "deadline": 5, ' +
      '"materials": [{"ticker": "RAT", "amount": 100}]} — BUY/SELL take "location" and ' +
      'per-material "price" instead. Every field is optional.',
    parse: parseContractJson,
    summarize: summarizeContractJson,
  },
  {
    id: 'sheets',
    label: 'Sheets/Excel',
    placeholder:
      'Paste rows copied from Sheets/Excel: amount, ticker, price (tab-separated). ' +
      'Contract fields are keyword rows: template, currency, location, origin, ' +
      'destination, payment, deadline, autoprovision — keyword in the first column, ' +
      'value in the second.',
    parse: parseSheetsExcel,
    summarize: summarizeSheetsExcel,
  },
  {
    id: 'prunplanner',
    label: 'Prun Planner',
    placeholder: 'Paste PRUNplanner supply cart JSON',
    parse: parseSupplyCart,
    summarize: summarizeSupplyCart,
  },
];

const dragTabId = 'drag';
const activeParserStorageKey = 'rprun-contd-paste-import-active';

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
    const canImport = computed(
      () =>
        !parsed.value.error &&
        (parsed.value.spec.materials.length > 0 || specHasContractFields(parsed.value.spec)),
    );
    const spec = computed(() => parsed.value.spec);
    return { kind: 'text' as const, ...parser, text, spec, status, isInvalid, canImport };
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
    spec: computed<ContractDraftSpec>(() => ({ materials: dragMaterials.value })),
    status: dragStatus,
    isInvalid: computed(() => false),
    canImport: computed(() => dragMaterials.value.length > 0),
  };

  let dragDepth = 0;
  const hoveredOption = ref<number | undefined>();
  // Every dragenter/dragover here must preventDefault AND stopPropagation AND
  // set an explicit dropEffect: the game's own top-level dragover handler
  // (running after ours in the bubble phase) resets dataTransfer.dropEffect
  // to 'none' for anything that isn't one of its own drop targets, and a
  // dragover that ends with dropEffect 'none' makes the browser cancel the
  // drop outright — dragend fires, drop never does. Synthetic DragEvent
  // dispatch skips this negotiation entirely, so only a real mouse drag
  // (pw-act real-drag-stack) catches a regression here.
  const acceptDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onZoneDragEnter = (e: DragEvent) => {
    acceptDrag(e);
    dragDepth++;
    dragHover.value ??= getDraggedStack();
  };
  const onZoneDragOver = (e: DragEvent) => acceptDrag(e);
  const onZoneDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dragHover.value = undefined;
      hoveredOption.value = undefined;
    }
  };
  const onZoneDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth = 0;
    dragHover.value = undefined;
    hoveredOption.value = undefined;
  };
  // Hover tracking via dragover (which fires continuously on the hovered
  // cell) instead of dragenter/dragleave pairs — moving onto the next cell
  // simply overwrites the index, and leaving the zone entirely is already
  // handled by onZoneDragLeave, so there's no leave-order bookkeeping.
  const onOptionDragOver = (e: DragEvent, index: number) => {
    acceptDrag(e);
    hoveredOption.value = index;
  };
  const onOptionDrop = (e: DragEvent, option: QuickAmount) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth = 0;
    const stack = dragHover.value;
    dragHover.value = undefined;
    hoveredOption.value = undefined;
    if (!stack || option.amount <= 0) {
      return;
    }
    dragMaterials.value.push({ ticker: stack.ticker, amount: option.amount });
  };

  const tabs = [...textInstances, dragInstance];
  const active = computed(() => tabs.find(tab => tab.id === activeParser.value));

  const importIssues = ref<string[] | undefined>();
  watch(active, () => (importIssues.value = undefined));
  const importStatus = computed(() => {
    if (importIssues.value === undefined) {
      return '';
    }
    return importIssues.value.length === 0
      ? 'Imported.'
      : `Imported, but failed: ${importIssues.value.join(', ')}.`;
  });

  let importing = false;
  const onImport = async () => {
    const instance = active.value;
    if (!instance || importing || !instance.canImport.value) {
      return;
    }
    importing = true;
    importIssues.value = undefined;
    try {
      importIssues.value = await importSpec(anchor, instance.spec.value);
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
                {quickAmounts(dragHover.value.quantity).map((option, index) => (
                  <div
                    class={$style.overlayCell}
                    onDragover={(e: DragEvent) => onOptionDragOver(e, index)}
                    onDrop={(e: DragEvent) => onOptionDrop(e, option)}>
                    <div
                      class={[
                        C.DropTargetView.item,
                        $style.overlaySquare,
                        hoveredOption.value === index && C.DropTargetView.isOver,
                      ]}>
                      {option.label}
                    </div>
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
            {importStatus.value && (
              <div
                class={[
                  $style.status,
                  C.type.typeSmall,
                  importIssues.value!.length > 0 && C.colors.textDanger,
                ]}>
                {importStatus.value}
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
  'CONTD: Adds a paste box at the top of the contract template screen to fill the full ' +
    'template (type, currency, materials, prices, locations, deadline) from contract JSON, ' +
    'Sheets/Excel rows, PRUNplanner JSON, or dragged material stacks.',
);

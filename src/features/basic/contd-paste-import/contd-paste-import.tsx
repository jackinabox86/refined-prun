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
// Multi-stack drags: the game lets a player ctrl-click several stacks to
// select them, then drag the group. Only the ctrl-clicked source fires
// dragstart, but the selection markers (C.GridItemView.selected on the
// GridItemView container, a sibling of the draggable image) stay in the DOM
// for the whole gesture, so the rest of the selected set is read back from
// there at drop time instead of from the drag payload. Dragging a stack that
// ISN'T part of the current selection makes the game drag only that stack
// (and clears the selection), so the source's own selected state decides
// which case applies.
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

function readStack(container: Element): DraggedStack | undefined {
  const ticker = _$(container, C.ColoredIcon.label)?.textContent?.trim();
  const quantityText = _$(container, C.MaterialIcon.indicator)?.textContent?.trim();
  if (!ticker || !quantityText) {
    return undefined;
  }
  const quantity = Number(quantityText.replace(/,/g, ''));
  return Number.isFinite(quantity) ? { ticker, quantity } : undefined;
}

function getDraggedStacks(): DraggedStack[] {
  const source = lastDragSource;
  if (!source) {
    return [];
  }
  const container = source.closest(`.${C.GridItemView.container}`);
  if (!container?.classList.contains(C.GridItemView.selected)) {
    const stack = readStack(source);
    return stack ? [stack] : [];
  }
  const grid = container.closest(`.${C.InventoryView.grid}`);
  const containers = grid ? _$$(grid, C.GridItemView.container) : [container];
  return containers
    .filter(x => x.classList.contains(C.GridItemView.selected))
    .map(readStack)
    .filter(x => x !== undefined);
}

interface QuickAmount {
  label: string;
  // Value used only to decide which options apply and their sort order —
  // based on the largest hovered stack, since a multi-stack drag hovers one
  // shared grid of boxes.
  amount: number;
  // Actual per-stack amount applied on drop, so each stack in a multi-stack
  // drag gets its own resolved quantity instead of sharing one fixed amount.
  resolve: (stack: DraggedStack) => number;
  // AMT doesn't add a row on drop — it opens the inline amount prompt below
  // the list instead, like the game's AMT box opens a MATERIAL TRANSFER buffer.
  prompt?: boolean;
}

// Mirrors the game's own quick-transfer boxes (verified against the real
// inventory-transfer overlay): AMT first, then every power of ten up to the
// stack size, HLF, and ALL, sorted ascending by amount — for an 18-stack the
// game really shows HLF(9) *before* 10, and a 21,697-stack gets 1000 and
// 10000 boxes. Equal values aren't deduped (a 10-stack shows both 10 and
// ALL), also matching the game. AMT appears only for a single-stack drag —
// the game omits it from multi-stack drags too — and opens the typed-amount
// prompt after the drop rather than adding a row, the panel-scale version of
// the game's AMT box opening a MATERIAL TRANSFER buffer.
//
// `quantity` is the largest quantity among the hovered stacks (a single
// stack is just the degenerate case), which decides which numeric boxes
// show. Each option's `resolve` is then applied per stack, so a multi-stack
// drop can yield different amounts per row from the same box.
function quickAmounts(quantity: number, single: boolean): QuickAmount[] {
  const options: QuickAmount[] = [
    { label: '1', amount: 1, resolve: stack => Math.min(1, stack.quantity) },
  ];
  for (let power = 10; power <= quantity; power *= 10) {
    options.push({
      label: String(power),
      amount: power,
      resolve: stack => Math.min(power, stack.quantity),
    });
  }
  options.push({
    label: 'HLF',
    amount: Math.floor(quantity / 2),
    resolve: stack => Math.max(1, Math.floor(stack.quantity / 2)),
  });
  options.push({ label: 'ALL', amount: quantity, resolve: stack => stack.quantity });
  const sorted = options.filter(option => option.amount >= 1).sort((a, b) => a.amount - b.amount);
  if (!single) {
    return sorted;
  }
  return [
    { label: 'AMT', amount: quantity, resolve: stack => stack.quantity, prompt: true },
    ...sorted,
  ];
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
  const dragHover = ref<DraggedStack[] | undefined>();
  // Stack awaiting a typed amount after an AMT drop; its row is added only on
  // confirm. Mirrors the game's MTRA buffer (text input prefilled to 1,
  // explicit confirm, amount validated against the stack size at submit
  // rather than as-you-type), inlined into the panel. Unlike MTRA the prompt
  // is purely local, so Enter/Escape work too, and the input is auto-focused
  // — the same nicety mtra-auto-focus-amount.ts adds to the real buffer.
  const amountPrompt = ref<DraggedStack | undefined>();
  const promptAmount = ref('');
  // One-shot flag: the template ref below fires on every re-render, but the
  // input should be focused only when the prompt opens, not on each keystroke.
  let promptNeedsFocus = false;
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
    // A new drag supersedes any amount prompt still open from the last drop.
    amountPrompt.value = undefined;
    if (!dragHover.value) {
      const stacks = getDraggedStacks();
      dragHover.value = stacks.length > 0 ? stacks : undefined;
    }
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
    const stacks = dragHover.value;
    dragHover.value = undefined;
    hoveredOption.value = undefined;
    if (!stacks) {
      return;
    }
    if (option.prompt) {
      amountPrompt.value = stacks[0];
      promptAmount.value = '1';
      promptNeedsFocus = true;
      return;
    }
    for (const stack of stacks) {
      const amount = option.resolve(stack);
      if (amount >= 1) {
        dragMaterials.value.push({ ticker: stack.ticker, amount });
      }
    }
  };
  const confirmPrompt = () => {
    const stack = amountPrompt.value;
    if (!stack) {
      return;
    }
    const typed = Number(promptAmount.value.replace(/,/g, ''));
    if (!Number.isFinite(typed)) {
      return;
    }
    const amount = Math.min(Math.max(Math.floor(typed), 1), stack.quantity);
    dragMaterials.value.push({ ticker: stack.ticker, amount });
    amountPrompt.value = undefined;
  };
  const onPromptKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== 'Escape') {
      return;
    }
    // Keep Enter/Escape away from the game's own document-level handlers.
    e.stopPropagation();
    if (e.key === 'Enter') {
      confirmPrompt();
    } else {
      amountPrompt.value = undefined;
    }
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
            {dragMaterials.value.length === 0 && !dragHover.value && !amountPrompt.value && (
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
            {amountPrompt.value && (
              <div class={$style.materialRow}>
                <span class={[$style.materialTicker, C.type.typeSmall]}>
                  {amountPrompt.value.ticker}
                </span>
                <input
                  type="text"
                  inputmode="numeric"
                  class={$style.amountInput}
                  value={promptAmount.value}
                  ref={el => {
                    if (!promptNeedsFocus || !el) {
                      return;
                    }
                    promptNeedsFocus = false;
                    const input = el as HTMLInputElement;
                    // Deferred like mtra-auto-focus-amount.ts: focus applied
                    // right after a drop can be stolen by drag-end handling.
                    setTimeout(() => {
                      input.focus();
                      input.select();
                    });
                  }}
                  onInput={(e: Event) =>
                    (promptAmount.value = (e.target as HTMLInputElement).value)
                  }
                  onKeydown={onPromptKeydown}
                />
                <PrunButton dark inline onClick={confirmPrompt}>
                  add
                </PrunButton>
                <PrunButton dark inline onClick={() => (amountPrompt.value = undefined)}>
                  x
                </PrunButton>
              </div>
            )}
            {dragHover.value && (
              <div class={$style.dropOverlay}>
                <div class={[$style.dropOverlayLabel, C.type.typeSmall]}>
                  {dragHover.value.map(stack => stack.ticker).join(', ')}
                </div>
                {quickAmounts(
                  Math.max(...dragHover.value.map(stack => stack.quantity)),
                  dragHover.value.length === 1,
                ).map((option, index) => (
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

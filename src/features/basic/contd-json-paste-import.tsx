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
function parseSheetsExcel(text: string): ParseResult {
  if (text.trim() === '') {
    return { materials: [] };
  }

  const materials: MaterialEntry[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      continue;
    }

    const [amountCol, tickerCol, priceCol] = line.split('\t');
    const amount = Number(amountCol?.trim());
    const ticker = tickerCol?.trim().toUpperCase();
    if (!ticker || !Number.isFinite(amount)) {
      return { error: `Invalid row: "${line.trim()}".`, materials: [] };
    }

    let price: number | undefined;
    const priceText = priceCol?.trim();
    if (priceText) {
      price = Number(priceText);
      if (!Number.isFinite(price)) {
        return { error: `Invalid row: "${line.trim()}".`, materials: [] };
      }
    }

    materials.push({ ticker, amount, price });
  }

  if (materials.length === 0) {
    return { error: 'No material rows found.', materials: [] };
  }

  return { materials };
}

function summarizeSheetsExcel(result: ParseResult): string {
  if (result.error) {
    return result.error;
  }
  if (result.materials.length === 0) {
    return '';
  }
  const { materials } = result;
  return `Parsed ${materials.length} material${materials.length === 1 ? '' : 's'}.`;
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

interface ParserConfig {
  id: string;
  label: string;
  placeholder: string;
  parse: (text: string) => ParseResult;
  summarize: (result: ParseResult) => string;
}

// One tab per supported paste format. Add an entry here to support a new source —
// each gets its own tab, textarea, and pasted-text state.
const parsers: ParserConfig[] = [
  {
    id: 'prunplanner',
    label: 'Prunplanner',
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

const activeParserStorageKey = 'rprun-contd-json-paste-active';

function insertPasteBox(container: Element, anchor: Element) {
  // Storage returns null only when the key was never set (first-ever use) —
  // that's the one case that should default to open. A hidden state is stored
  // as '' rather than removed, so it round-trips instead of getting read back
  // as null and falling through to the default.
  const activeParser = ref(localStorage.getItem(activeParserStorageKey) ?? parsers[0].id);
  watch(activeParser, value => localStorage.setItem(activeParserStorageKey, value));

  const instances = parsers.map(parser => {
    const text = ref('');
    const parsed = computed(() => parser.parse(text.value));
    const status = computed(() => parser.summarize(parsed.value));
    const isInvalid = computed(() => parsed.value.error !== undefined);
    const canImport = computed(() => !parsed.value.error && parsed.value.materials.length > 0);
    return { ...parser, text, parsed, status, isInvalid, canImport };
  });

  const active = computed(() => instances.find(instance => instance.id === activeParser.value));

  let importing = false;
  const onImport = async () => {
    const instance = active.value;
    if (!instance || importing || !instance.canImport.value) {
      return;
    }
    importing = true;
    try {
      await importMaterials(anchor, instance.parsed.value.materials);
    } finally {
      importing = false;
    }
  };

  createFragmentApp(() => {
    const instance = active.value;
    return (
      <div class={$style.container}>
        <div class={$style.tabRow}>
          {parsers.map(parser => (
            <PrunButton
              dark={activeParser.value !== parser.id}
              primary={activeParser.value === parser.id}
              inline
              onClick={() => (activeParser.value = parser.id)}>
              {parser.label}
            </PrunButton>
          ))}
          {instance && (
            <PrunButton neutral inline onClick={() => (activeParser.value = '')}>
              Hide
            </PrunButton>
          )}
        </div>
        {instance && (
          <>
            <textarea
              class={[C.TextareaInput.textarea, $style.textarea]}
              placeholder={instance.placeholder}
              value={instance.text.value}
              onInput={(e: Event) =>
                (instance.text.value = (e.target as HTMLTextAreaElement).value)
              }
            />
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
          </>
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
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Adds a paste box at the top of the commodity template screen to import materials/amounts from PRUNplanner JSON or Sheets/Excel rows.',
);

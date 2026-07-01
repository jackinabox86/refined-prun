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
}

interface ParseResult {
  error?: string;
  groupCount: number;
  materials: MaterialEntry[];
}

function parseSupplyCart(json: string): ParseResult {
  if (json.trim() === '') {
    return { groupCount: 0, materials: [] };
  }

  let data: SupplyCartJson;
  try {
    data = JSON.parse(json);
  } catch {
    return { error: 'Invalid JSON.', groupCount: 0, materials: [] };
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];
  if (groups.length === 0) {
    return { error: 'No material groups found.', groupCount: 0, materials: [] };
  }

  const materials = groups.flatMap(group =>
    Object.entries(group.materials ?? {}).map(([ticker, amount]) => ({ ticker, amount })),
  );

  return { groupCount: groups.length, materials };
}

function summarize(result: ParseResult): string {
  if (result.error) {
    return result.error;
  }
  if (result.groupCount === 0) {
    return '';
  }
  const { groupCount, materials } = result;
  return `Parsed ${groupCount} group${groupCount === 1 ? '' : 's'}, ${materials.length} material${materials.length === 1 ? '' : 's'}.`;
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

// Adds/fills CONTD commodity rows from parsed JSON. Same job as addMaterials() in
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
    const { ticker, amount } = materials[i];

    const amountInput = group.querySelector(
      'input[inputmode="numeric"]',
    ) as HTMLInputElement | null;
    if (amountInput) {
      focusElement(amountInput);
      changeInputValue(amountInput, String(amount));
    }

    const materialSelectorContainer = _$(group, C.MaterialSelector.container);
    if (materialSelectorContainer) {
      await selectMaterialInMaterialSelector(materialSelectorContainer, ticker);
    }
  }
}

function insertPasteBox(container: Element, anchor: Element) {
  const jsonText = ref('');
  const parsed = computed(() => parseSupplyCart(jsonText.value));
  const status = computed(() => summarize(parsed.value));
  const isInvalid = computed(() => parsed.value.error !== undefined);
  const canImport = computed(() => !parsed.value.error && parsed.value.materials.length > 0);

  let importing = false;
  const onImport = async () => {
    if (importing || !canImport.value) {
      return;
    }
    importing = true;
    try {
      await importMaterials(anchor, parsed.value.materials);
    } finally {
      importing = false;
    }
  };

  createFragmentApp(() => (
    <div class={$style.container}>
      <textarea
        class={$style.textarea}
        placeholder="Paste PRUNplanner supply cart JSON (parsing only, for now)"
        value={jsonText.value}
        onInput={(e: Event) => (jsonText.value = (e.target as HTMLTextAreaElement).value)}
      />
      <div class={$style.row}>
        {status.value && (
          <div class={[$style.status, C.type.typeSmall, isInvalid.value && C.colors.textDanger]}>
            {status.value}
          </div>
        )}
        {canImport.value && (
          <PrunButton dark inline onClick={onImport}>
            Import
          </PrunButton>
        )}
      </div>
    </div>
  )).before(container);
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
  'CONTD: Adds a paste box at the top of the commodity template screen to parse JSON and create the right number of commodity sections with material and amount filled in.',
);

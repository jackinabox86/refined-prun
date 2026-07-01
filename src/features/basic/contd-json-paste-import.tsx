import $style from './contd-json-paste-import.module.css';

interface SupplyCartJson {
  groups?: Array<{ name?: string; materials?: Record<string, number> }>;
}

function summarize(json: string): string {
  if (json.trim() === '') {
    return '';
  }

  let data: SupplyCartJson;
  try {
    data = JSON.parse(json);
  } catch {
    return 'Invalid JSON.';
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];
  if (groups.length === 0) {
    return 'No material groups found.';
  }

  const materialCount = sumBy(groups, group =>
    group.materials ? Object.keys(group.materials).length : 0,
  );
  return `Parsed ${groups.length} group${groups.length === 1 ? '' : 's'}, ${materialCount} material${materialCount === 1 ? '' : 's'}.`;
}

function insertPasteBox(container: Element) {
  const jsonText = ref('');
  const status = computed(() => summarize(jsonText.value));
  const isInvalid = computed(() => status.value === 'Invalid JSON.');

  createFragmentApp(() => (
    <div class={$style.container}>
      <textarea
        class={$style.textarea}
        placeholder="Paste PRUNplanner supply cart JSON (parsing only, for now)"
        value={jsonText.value}
        onInput={(e: Event) => (jsonText.value = (e.target as HTMLTextAreaElement).value)}
      />
      {status.value && (
        <div class={[$style.status, C.type.typeSmall, isInvalid.value && C.colors.textDanger]}>
          {status.value}
        </div>
      )}
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
    insertPasteBox(container);
  });
}

function init() {
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Adds a paste box at the top of the commodity template screen to parse JSON input (parsing only, for now).',
);

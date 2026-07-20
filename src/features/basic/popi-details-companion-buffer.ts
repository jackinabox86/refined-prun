import { $ } from '@src/utils/select-dom';
import { setBufferSize } from '@src/infrastructure/prun-ui/buffers';
import { clickElement, changeInputValue } from '@src/util';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { lookupLocalization } from '@src/infrastructure/prun-ui/i18n';

const infraGlobalNames: Record<string, string> = {
  planetaryProjectSafetySmall: 'SST',
  planetaryProjectSafetyBig: 'SDP',
  planetaryProjectSafetyHealth: 'EMC',
  planetaryProjectHealthSmall: 'INF',
  planetaryProjectHealthBig: 'HOS',
  planetaryProjectHealthComfort: 'WCE',
  planetaryProjectComfortSmall: 'PAR',
  planetaryProjectComfortBig: '4DA',
  planetaryProjectComfortCulture: 'ACA',
  planetaryProjectCultureSmall: 'ART',
  planetaryProjectCultureBig: 'VRT',
  planetaryProjectCultureEducation: 'PBH',
  planetaryProjectEducationBig: 'UNI',
  planetaryProjectEducationSmall: 'LIB',
};

function buildNameToTicker(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [globalName, ticker] of Object.entries(infraGlobalNames)) {
    const name = lookupLocalization(L.Reactor, `${globalName}_name`)();
    if (name) {
      map.set(name, ticker);
    }
  }
  return map;
}

function getRowName(row: Element): string | undefined {
  if (row.children.length === 0) {
    return undefined;
  }
  const text = row.children[0].firstElementChild?.firstElementChild?.textContent?.trim();
  return text ?? undefined;
}

function onTileReady(tile: PrunTile) {
  const nameToTicker = buildNameToTicker();

  subscribe($$(tile.anchor, C.Population.table), table => {
    subscribe($$(table, 'tr'), row => {
      if (_$(row, 'th') !== undefined) {
        return;
      }

      const detailsBtn = _$$(row, C.Button.btn).find(x => x.textContent === 'details');
      if (!detailsBtn) {
        return;
      }

      detailsBtn.addEventListener('click', (e: MouseEvent) => {
        if (!e.shiftKey) {
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        const name = getRowName(row);
        if (!name) {
          return;
        }
        const ticker = nameToTicker.get(name);
        if (!ticker) {
          return;
        }
        void openCompanionBuffer(tile, `POPID P-${tile.parameter} T-${ticker}`);
      });
    });
  });
}

async function openCompanionBuffer(tile: PrunTile, command: string) {
  const windowEl = tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;

  if (tile.container.classList.contains(C.Window.body)) {
    const parsedW = parseInt(tile.container.style.width, 10);
    const parsedH = parseInt(tile.container.style.height, 10);
    const w = Number.isNaN(parsedW) ? 600 : parsedW;
    const h = Number.isNaN(parsedH) ? 400 : parsedH;
    setBufferSize(tile.id, w + 450, h);

    const splitButton = _$$(tile.frame, C.TileControls.control).find(x => x.textContent === '|');
    await clickElement(splitButton);

    if (!windowEl) {
      return;
    }

    const node = await $(windowEl, C.Node.node);
    const companion = _$$(node, C.Node.child)[1] as HTMLElement | undefined;
    if (companion) {
      await setChildCommand(companion, command);
    }
  } else if (tile.container.classList.contains(C.Node.child)) {
    const node = tile.container.parentElement!;
    const sibling = _$$(node, C.Node.child).find(x => x !== tile.container);
    if (sibling) {
      await setChildCommand(sibling, command);
    }
  }
}

async function setChildCommand(child: Element, command: string) {
  const tileEl = _$(child, C.Tile.tile) as HTMLElement | null;
  const id = tileEl !== null ? getPrunId(tileEl) : null;
  if (id !== null && dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(id, command))) {
    return;
  }
  const input = (await $(child, C.PanelSelector.input)) as HTMLInputElement;
  changeInputValue(input, command);
  input.form!.requestSubmit();
}

function init() {
  tiles.observe('POPI', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'POPI: Shift-click the details button to open the POPID buffer as a companion.',
);

import { getInvStore } from '@src/core/store-id';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { setBufferSize } from '@src/infrastructure/prun-ui/buffers';
import { clickElement, changeInputValue } from '@src/util';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import StoSummaryPanel from './StoSummaryPanel.vue';

async function onTileReady(tile: PrunTile) {
  const store = computed(() => getInvStore(tile.parameter));
  const site = computed(() =>
    store.value ? sitesStore.getById(store.value.addressableId) : undefined,
  );
  const naturalId = computed(() =>
    site.value ? getEntityNaturalIdFromAddress(site.value.address) : undefined,
  );

  const contextBar = await $(tile.frame, C.ContextControls.container);

  let panelShown = false;

  createFragmentApp(() => {
    if (!naturalId.value) {
      return null;
    }
    return (
      <button
        class={[C.Button.btn, C.Button.primary]}
        onClick={() => {
          if (!panelShown) {
            showPanel(tile, naturalId.value!);
            panelShown = true;
          }
        }}>
        Analysis - XIT STO
      </button>
    );
  }).prependTo(contextBar);
}

function showPanel(tile: PrunTile, naturalId: string) {
  const storeContainer = _$(tile.anchor, C.StoreView.container) as HTMLElement | null;
  if (!storeContainer) {
    return;
  }

  // Make anchor a flex column so the panel sits below the store view.
  tile.anchor.style.display = 'flex';
  tile.anchor.style.flexDirection = 'column';
  storeContainer.style.flex = '1';
  storeContainer.style.minHeight = '0';
  storeContainer.style.overflow = 'hidden';

  const panelWrapper = document.createElement('div');
  panelWrapper.style.flexShrink = '0';
  tile.anchor.appendChild(panelWrapper);

  let ro: ResizeObserver | undefined;

  createFragmentApp(StoSummaryPanel, {
    naturalId,
    onExpand: () => {
      ro?.disconnect();
      panelWrapper.remove();
      void openAnalysis(tile, naturalId);
    },
  }).appendTo(panelWrapper);

  // Grow a solo floating buffer so the panel doesn't cover existing content.
  if (tile.container.classList.contains(C.Window.body)) {
    const parsedW = parseInt(tile.container.style.width, 10);
    const parsedH = parseInt(tile.container.style.height, 10);
    const w = Number.isNaN(parsedW) ? 600 : parsedW;
    const h = Number.isNaN(parsedH) ? 400 : parsedH;
    let prevPanelHeight = 0;
    ro = new ResizeObserver(() => {
      const panelHeight = panelWrapper.offsetHeight;
      if (panelHeight !== prevPanelHeight) {
        prevPanelHeight = panelHeight;
        setBufferSize(tile.id, w, h + panelHeight);
      }
    });
    ro.observe(panelWrapper);
  }
}

async function openAnalysis(tile: PrunTile, naturalId: string) {
  const command = `XIT STO ${naturalId}`;
  const windowEl = tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;

  if (tile.container.classList.contains(C.Window.body)) {
    // Solo floating buffer: resize taller and split vertically.
    const parsedW = parseInt(tile.container.style.width, 10);
    const parsedH = parseInt(tile.container.style.height, 10);
    const w = Number.isNaN(parsedW) ? 600 : parsedW;
    const h = Number.isNaN(parsedH) ? 400 : parsedH;
    setBufferSize(tile.id, w, h + 450);

    const splitButton = _$$(tile.frame, C.TileControls.control).find(x => x.textContent === '–');
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
    // Already in a split: find the sibling and change its command.
    const node = tile.container.parentElement!;
    const sibling = _$$(node, C.Node.child).find(x => x !== tile.container);
    if (sibling) {
      await setChildCommand(sibling, command);
    }
  }
}

async function setChildCommand(child: Element, command: string) {
  const tileEl = _$(child, C.Tile.tile) as HTMLElement | null;
  if (!tileEl) {
    return;
  }

  const id = getPrunId(tileEl)!;
  const message = UI_TILES_CHANGE_COMMAND(id, command);
  if (!dispatchClientPrunMessage(message)) {
    const input = (await $(child, C.PanelSelector.input)) as HTMLInputElement;
    changeInputValue(input, command);
    input.form!.requestSubmit();
  }
}

function init() {
  tiles.observe('INV', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'INV: Adds an Analysis button that shows an XIT STO summary pane, expandable to a full companion buffer.',
);

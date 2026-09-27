import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import {
  getLocationLineFromAddress,
  isPlanetLine,
  isStationLine,
} from '@src/infrastructure/prun-api/data/addresses';
import { lmBufferCommand } from '@src/core/lm-link';
import { shouldNarrowShipContextCommand } from '@src/features/basic/shpi-context-command';

function narrowShipContextItem(item: HTMLElement) {
  const cmd = _$(item, C.ContextControls.cmd);
  if (cmd === null || cmd === undefined) {
    return;
  }
  if (!shouldNarrowShipContextCommand(cmd.textContent)) {
    return;
  }
  const parent = cmd.parentNode;
  if (parent === null) {
    return;
  }
  for (const node of Array.from(parent.childNodes)) {
    if (node === cmd || node.nodeType !== Node.TEXT_NODE) {
      continue;
    }
    node.textContent = '';
  }
}

async function onTileReady(tile: PrunTile) {
  subscribe($$(tile.frame, C.ContextControls.item), narrowShipContextItem);

  const ship = computed(() => shipsStore.getByRegistration(tile.parameter));

  // Link wherever the ship is docked and let LM answer for itself. A planet with
  // no local market shows the game's own error, which is the wanted behavior --
  // gating on FIO's HasLocalMarket only bought a way for the link to go missing.
  const linkId = computed(() => {
    const current = ship.value;
    if (current === undefined || current.flightId !== null) {
      return undefined;
    }
    const line = getLocationLineFromAddress(current.address ?? undefined);
    if (isStationLine(line) || isPlanetLine(line)) {
      return line.entity.naturalId;
    }
    return undefined;
  });

  const contextBar = await $(tile.frame, C.ContextControls.container);
  createFragmentApp(() => {
    const id = linkId.value;
    if (id === undefined) {
      return null;
    }
    return (
      <div
        class={[C.ContextControls.item, C.fonts.fontRegular, C.type.typeSmall]}
        onClick={() => showBuffer(lmBufferCommand(id))}>
        <span>
          <span class={C.ContextControls.cmd}>LM</span>
          {` ${id}`}
        </span>
      </div>
    );
  }).prependTo(contextBar);
}

function init() {
  tiles.observe('SHPI', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'SHPI: Adds an LM link for the location the ship is docked at, and drops the ship id from SHP, SHPF, and SFC.',
);

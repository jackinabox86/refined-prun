import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import {
  getLocationLineFromAddress,
  isPlanetLine,
  isStationLine,
} from '@src/infrastructure/prun-api/data/addresses';
import { fetchPlanetHasLocalMarket } from '@src/infrastructure/fio/planet-local-market';
import { lmBufferCommand, lmLinkNaturalId, PlanetLocalMarket } from '@src/core/lm-link';
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

  const location = computed(() => {
    const current = ship.value;
    if (current === undefined || current.flightId !== null) {
      return undefined;
    }
    const line = getLocationLineFromAddress(current.address ?? undefined);
    if (isStationLine(line)) {
      return { kind: 'station' as const, naturalId: line.entity.naturalId };
    }
    if (isPlanetLine(line)) {
      return { kind: 'planet' as const, naturalId: line.entity.naturalId };
    }
    return undefined;
  });

  // Watch the id, not `location`. `location` rebuilds its object on every update
  // to the ship's own record, so watching it re-ran this on unrelated changes and
  // cancelled the request in flight — the link never appeared on a planet. A
  // string only trips the watcher when the ship actually changes location.
  const planetNaturalId = computed(() =>
    location.value?.kind === 'planet' ? location.value.naturalId : undefined,
  );
  const planetLocalMarket = ref<PlanetLocalMarket>('loading');

  watch(
    planetNaturalId,
    async (naturalId, _previous, onCleanup) => {
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      planetLocalMarket.value = 'loading';
      if (naturalId === undefined) {
        return;
      }
      const value = await fetchPlanetHasLocalMarket(naturalId);
      if (cancelled) {
        return;
      }
      planetLocalMarket.value = value ?? 'unavailable';
    },
    { immediate: true },
  );

  const linkId = computed(() =>
    lmLinkNaturalId({
      inFlight: ship.value !== undefined && ship.value.flightId !== null,
      kind: location.value?.kind,
      naturalId: location.value?.naturalId,
      planetLocalMarket: planetLocalMarket.value,
    }),
  );

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
  'SHPI: Adds an LM link when the ship is at a commodity exchange or a planet with a local market, and drops the ship id from SHP, SHPF, and SFC.',
);

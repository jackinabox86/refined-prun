import PrunButton from '@src/components/PrunButton.vue';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import $style from './sfc-exchange-destinations.module.css';

// Commodity exchange stations, by their own natural ids. Ordered the way the
// game lists their exchange codes (AI1, CI1, IC1, NC1).
const exchangeStationIds = ['ANT', 'BEN', 'HRT', 'MOR'];

function onTileReady(tile: PrunTile) {
  // A docked ship's address resolves to the station's own natural id ("ANT");
  // in flight it has no address, so no button is grayed out.
  const location = computed(() =>
    getEntityNaturalIdFromAddress(
      shipsStore.getByRegistration(tile.parameter)?.address ?? undefined,
    ),
  );

  subscribe($$(tile.anchor, C.AddressSelector.container), container => {
    createFragmentApp(() => (
      <div class={$style.buttons}>
        {exchangeStationIds.map(naturalId => (
          <PrunButton
            key={naturalId}
            dark
            inline
            disabled={location.value === naturalId}
            class={$style.button}
            onClick={() => selectAddress(container, naturalId)}>
            {naturalId}
          </PrunButton>
        ))}
      </div>
    )).appendTo(container);
  });
}

function init() {
  tiles.observe('SFC', onTileReady);
  applyCssRule('SFC', `.${C.AddressSelector.container}`, $style.container);
  applyCssRule('SFC', `.${C.AddressSelector.input}`, $style.input);
}

features.add(
  import.meta.url,
  init,
  'SFC: Adds commodity exchange shortcut buttons to the destination field.',
);

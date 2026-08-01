import PrunButton from '@src/components/PrunButton.vue';
import { stationsStore } from '@src/infrastructure/prun-api/data/stations';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import $style from './sfc-exchange-destinations.module.css';

// Commodity exchange stations, by their own natural ids. Ordered the way the
// game lists their exchange codes (AI1, CI1, IC1, NC1).
const exchangeStationIds = ['ANT', 'BEN', 'HRT', 'MOR'];

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AddressSelector.container), container => {
    createFragmentApp(() => (
      <div class={$style.buttons}>
        {exchangeStationIds.map(naturalId => (
          <PrunButton
            key={naturalId}
            dark
            inline
            class={$style.button}
            data-tooltip={stationsStore.getByNaturalId(naturalId)?.name ?? naturalId}
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

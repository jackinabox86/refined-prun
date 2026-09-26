import PrunButton from '@src/components/PrunButton.vue';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import { userData } from '@src/store/user-data';
import $style from './sfc-exchange-destinations.module.css';

// Shortcuts are set in XIT SET's SFC tab (default: the four commodity exchange
// stations). Slots without a destination are dropped so no empty button
// renders; labels always show upper-cased, falling back to the destination.
const shortcuts = computed(() =>
  userData.settings.sfcShortcuts
    .map(x => ({ label: x.label.trim(), destination: x.destination.trim() }))
    .filter(x => x.destination.length > 0)
    .map(x => ({
      label: (x.label || x.destination).toUpperCase(),
      destination: x.destination,
    })),
);

function onTileReady(tile: PrunTile) {
  // A docked ship's address resolves to the station's own natural id ("ANT")
  // or the planet's ("OT-580b"); in flight it has no address, so no button is
  // grayed out. The name is kept too, so a shortcut entered as "Montem" matches.
  const location = computed(() => {
    const address = shipsStore.getByRegistration(tile.parameter)?.address ?? undefined;
    return [getEntityNaturalIdFromAddress(address), getEntityNameFromAddress(address)]
      .filter(x => x !== undefined)
      .map(x => x.toUpperCase());
  });

  subscribe($$(tile.anchor, C.AddressSelector.container), container => {
    createFragmentApp(() => (
      <div class={$style.buttons}>
        {shortcuts.value.map((shortcut, i) => (
          <PrunButton
            key={i}
            dark
            inline
            disabled={location.value.includes(shortcut.destination.toUpperCase())}
            class={$style.button}
            onClick={() => selectAddress(container, shortcut.destination)}>
            {shortcut.label}
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
  'SFC: Adds destination shortcut buttons (set in XIT SET) to the destination field.',
);

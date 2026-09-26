import PrunButton from '@src/components/PrunButton.vue';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import { userData } from '@src/store/user-data';
import $style from './sfc-exchange-destinations.module.css';

// Shortcuts are set in XIT ACT's SFC tab (default: the four commodity exchange
// stations). Blank slots are dropped so no empty button renders.
const shortcuts = computed(() =>
  userData.settings.sfcShortcuts.map(x => x.trim()).filter(x => x.length > 0),
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
            disabled={location.value.includes(shortcut.toUpperCase())}
            class={$style.button}
            onClick={() => selectAddress(container, shortcut)}>
            {shortcut}
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
  'SFC: Adds destination shortcut buttons (set in XIT ACT) to the destination field.',
);

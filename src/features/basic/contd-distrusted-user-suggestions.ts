import distrust from '@src/infrastructure/prun-ui/css/distrust.module.css';
import { isDistrustedUsername } from '@src/store/distrust';
import { refTextContent } from '@src/utils/reactive-dom';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.UserSelector.suggestionName), onSuggestionName);
}

function onSuggestionName(suggestionName: HTMLElement) {
  const username = refTextContent(suggestionName);
  watchEffectWhileNodeAlive(suggestionName, () => {
    suggestionName.classList.toggle(distrust.distrusted, isDistrustedUsername(username.value));
  });
}

function init() {
  tiles.observe('CONTD', onTileReady);
}

features.add(import.meta.url, init, 'CONTD: Highlights distrusted users in recipient suggestions.');

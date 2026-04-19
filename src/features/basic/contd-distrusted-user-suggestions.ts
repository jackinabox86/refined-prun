import distrust from '@src/infrastructure/prun-ui/css/distrust.module.css';
import { isDistrustedUsername } from '@src/store/distrust';
import { refTextContent } from '@src/utils/reactive-dom';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.UserSelector.suggestion), onSuggestion);
}

function onSuggestion(suggestion: HTMLElement) {
  const nameElement = _$(suggestion, C.UserSelector.suggestionName);
  if (!nameElement) {
    return;
  }
  const username = refTextContent(nameElement);
  watchEffectWhileNodeAlive(suggestion, () => {
    suggestion.classList.toggle(distrust.distrusted, isDistrustedUsername(username.value));
  });
}

function init() {
  tiles.observe('CONTD', onTileReady);
}

features.add(import.meta.url, init, 'CONTD: Highlights distrusted users in recipient suggestions.');

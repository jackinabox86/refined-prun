import distrust from '@src/infrastructure/prun-ui/css/distrust.module.css';
import { isDistrustedUsername } from '@src/store/distrust';
import { refTextContent } from '@src/utils/reactive-dom';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';

function onSuggestionEntry(entry: HTMLElement) {
  const nameElement = _$(entry, C.UserSelector.suggestionName);
  if (!nameElement) {
    return;
  }
  const username = refTextContent(nameElement as HTMLElement);
  watchEffectWhileNodeAlive(nameElement, () => {
    nameElement.classList.toggle(distrust.distrusted, isDistrustedUsername(username.value));
  });
}

function init() {
  // Subscribe at document scope: the UserSelector's dropdown may render outside
  // any single tile.anchor, and suggestionEntry/suggestionName classes are
  // shared across all user selectors anyway.
  subscribe($$(document, C.UserSelector.suggestionEntry), onSuggestionEntry);
}

features.add(import.meta.url, init, 'Highlights distrusted users in user selector suggestions.');

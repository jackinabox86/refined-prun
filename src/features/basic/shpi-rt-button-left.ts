import { onNodeTreeMutation } from '@src/utils/on-node-tree-mutation';

function getCommand(item: Element) {
  return _$(item, C.ContextControls.cmd)?.textContent;
}

async function onTileReady(tile: PrunTile) {
  const contextBar = await $(tile.frame, C.ContextControls.container);

  // Other features prepend their items after the game renders RT, so re-anchor it
  // on every change to keep it in front of the first command item.
  const moveRouteItem = () => {
    const items = _$$(contextBar, C.ContextControls.item).filter(x => getCommand(x) !== undefined);
    const route = items.find(x => getCommand(x) === 'RT');
    const first = items[0];
    if (route === undefined || route === first) {
      return;
    }
    first.before(route);
  };
  moveRouteItem();
  onNodeTreeMutation(contextBar, moveRouteItem);
}

function init() {
  tiles.observe('SHPI', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'SHPI: Moves the RT context item to the left of the other context items.',
);

import GripCell from '@src/components/grip/GripCell.vue';
import GripHeaderCell from '@src/components/grip/GripHeaderCell.vue';
import { userData } from '@src/store/user-data';

const exchanges: UserData.Exchange[] = ['AI1', 'CI1', 'CI2', 'IC1', 'NC1', 'NC2'];

function init() {
  tiles.observe('CXM', onTileReady);
}

function onTileReady(tile: PrunTile) {
  console.log('CXM Tile opened', tile);
  subscribe($$(tile.anchor, 'table'), table => {
    console.log('CXM table found', table);
    if (table.dataset.cxmReorderProcessed) {
      return;
    }
    table.dataset.cxmReorderProcessed = 'true';

    subscribe($$(table, 'thead'), thead => {
      console.log('CXM thead found', thead);
      const headerRow = thead.querySelector('tr');
      if (headerRow && !headerRow.dataset.gripAdded) {
        headerRow.dataset.gripAdded = 'true';
        createFragmentApp(GripHeaderCell).prependTo(headerRow);
        console.log('GripHeaderCell added');
      }
    });

    subscribe($$(table, 'tbody'), tbody => {
      console.log('CXM tbody found', tbody);
      setupDragAndDrop(tbody as HTMLTableSectionElement);
      reorderTable(tbody as HTMLTableSectionElement);
    });
  });
}

let draggedRow: HTMLTableRowElement | null = null;

function setupDragAndDrop(tbody: HTMLTableSectionElement) {
  const observer = new MutationObserver(mutations => {
    let shouldReorder = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLTableRowElement && !node.dataset.gripAdded) {
            processRow(node);
            shouldReorder = true;
          }
        }
      }
    }
    if (shouldReorder) {
      reorderTable(tbody);
    }
  });

  observer.observe(tbody, { childList: true });

  for (const row of Array.from(tbody.querySelectorAll('tr'))) {
    if (!row.dataset.gripAdded) {
      processRow(row);
    }
  }

  tbody.addEventListener('dragover', e => {
    e.preventDefault();
    if (!draggedRow) {
      return;
    }

    const target = e.target as HTMLElement;
    const targetRow = target.closest('tr');

    if (targetRow && targetRow !== draggedRow && targetRow.parentElement === tbody) {
      const rect = targetRow.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
      tbody.insertBefore(draggedRow, next ? targetRow.nextSibling : targetRow);
    }
  });

  tbody.addEventListener('dragend', () => {
    if (!draggedRow) {
      return;
    }
    draggedRow.style.opacity = '1';
    draggedRow = null;
    saveOrder(tbody);
  });
}

function processRow(row: HTMLTableRowElement) {
  row.dataset.gripAdded = 'true';

  createFragmentApp(GripCell).prependTo(row);

  row.addEventListener('mousedown', e => {
    const target = e.target as HTMLElement;
    if (target.closest('td') === row.firstElementChild) {
      row.draggable = true;
    }
  });

  row.addEventListener('mouseup', () => {
    row.draggable = false;
  });

  row.addEventListener('mouseleave', () => {
    row.draggable = false;
  });

  row.addEventListener('dragstart', e => {
    draggedRow = row;
    setTimeout(() => {
      if (draggedRow === row) {
        row.style.opacity = '0.5';
      }
    }, 0);

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', getExchange(row) || '');
    }
  });
}

function getExchange(row: HTMLTableRowElement) {
  for (const cell of Array.from(row.cells)) {
    const text = cell.textContent?.trim();
    if (text && exchanges.includes(text as UserData.Exchange)) {
      return text;
    }
  }
  return '';
}

function reorderTable(tbody: HTMLTableSectionElement) {
  const order = userData.settings.cxmOrder;
  if (order.length === 0) {
    return;
  }

  const rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    const exA = getExchange(a);
    const exB = getExchange(b);

    let indexA = order.indexOf(exA as UserData.Exchange);
    let indexB = order.indexOf(exB as UserData.Exchange);

    if (indexA === -1) {
      indexA = 999;
    }
    if (indexB === -1) {
      indexB = 999;
    }

    return indexA - indexB;
  });

  for (const row of rows) {
    tbody.appendChild(row);
  }
}

function saveOrder(tbody: HTMLTableSectionElement) {
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const newOrder: UserData.Exchange[] = [];
  for (const row of rows) {
    const ex = getExchange(row) as UserData.Exchange;
    if (ex) {
      newOrder.push(ex);
    }
  }

  if (newOrder.length > 0) {
    const currentOrder = [...userData.settings.cxmOrder];
    for (const ex of newOrder) {
      const idx = currentOrder.indexOf(ex);
      if (idx !== -1) {
        currentOrder.splice(idx, 1);
      }
    }
    userData.settings.cxmOrder = [...newOrder, ...currentOrder];
  }
}

features.add(
  import.meta.url,
  init,
  'CXM Reordering: Drag-and-drop to reorder exchanges in the CXM buffer.',
);

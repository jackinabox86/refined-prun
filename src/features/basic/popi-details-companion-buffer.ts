import { openCompanionBuffer } from '@src/infrastructure/prun-ui/companion-buffer';
import { PrunI18N } from '@src/infrastructure/prun-ui/i18n';

const infraGlobalNames: Record<string, string> = {
  planetaryProjectSafetySmall: 'SST',
  planetaryProjectSafetyBig: 'SDP',
  planetaryProjectSafetyHealth: 'EMC',
  planetaryProjectHealthSmall: 'INF',
  planetaryProjectHealthBig: 'HOS',
  planetaryProjectHealthComfort: 'WCE',
  planetaryProjectComfortSmall: 'PAR',
  planetaryProjectComfortBig: '4DA',
  planetaryProjectComfortCulture: 'ACA',
  planetaryProjectCultureSmall: 'ART',
  planetaryProjectCultureBig: 'VRT',
  planetaryProjectCultureEducation: 'PBH',
  planetaryProjectEducationBig: 'UNI',
  planetaryProjectEducationSmall: 'LIB',
};

function buildNameToTicker(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [globalName, ticker] of Object.entries(infraGlobalNames)) {
    const name = PrunI18N[`Reactor.${globalName}_name`]?.[0]?.value;
    if (name) {
      map.set(name, ticker);
    }
  }
  return map;
}

function getRowName(row: Element): string | undefined {
  if (row.children.length === 0) {
    return undefined;
  }
  const text = row.children[0].firstElementChild?.firstElementChild?.textContent?.trim();
  return text ?? undefined;
}

function onTileReady(tile: PrunTile) {
  const nameToTicker = buildNameToTicker();

  subscribe($$(tile.anchor, C.Population.table), table => {
    subscribe($$(table, 'tr'), row => {
      if (_$(row, 'th') !== undefined) {
        return;
      }

      const detailsBtn = _$$(row, C.Button.btn).find(x => x.textContent === 'details');
      if (!detailsBtn) {
        return;
      }

      detailsBtn.addEventListener('click', (e: MouseEvent) => {
        if (!e.shiftKey) {
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        const name = getRowName(row);
        if (!name) {
          return;
        }
        const ticker = nameToTicker.get(name);
        if (!ticker) {
          return;
        }
        void openCompanionBuffer(tile, `POPID P-${tile.parameter} T-${ticker}`);
      });
    });
  });
}

function init() {
  tiles.observe('POPI', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'POPI: Shift-click the details button to open the POPID buffer as a companion.',
);

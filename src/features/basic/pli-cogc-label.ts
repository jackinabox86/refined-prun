import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { lookupLocalization } from '@src/infrastructure/prun-ui/i18n';

function formatCogcLabel(programType?: string | null) {
  if (!programType) {
    return 'COGC (Inactive)';
  }
  const localized = lookupLocalization(L.CoGCProgram, `${programType}_SHORT`)();
  if (localized) {
    return `COGC (${localized})`;
  }
  let program = programType;
  for (const prefix of ['ADVERTISING_', 'WORKFORCE_']) {
    if (program.startsWith(prefix)) {
      program = program.slice(prefix.length);
      break;
    }
  }
  const words = program
    .split('_')
    .map(x => x.charAt(0) + x.slice(1).toLowerCase())
    .join(' ');
  return `COGC (${words})`;
}

function onTileReady(tile: PrunTile) {
  const localizedLabel = L.PlanetaryProjects.COGC();
  subscribe($$(tile.anchor, C.PlanetaryProjectsList.row), row => {
    const link = _$(row, C.Link.link);
    if (!link || link.textContent !== localizedLabel) {
      return;
    }
    const programType = planetsStore.find(tile.parameter)?.cogcProgramType;
    link.textContent = formatCogcLabel(programType);
  });
}

function init() {
  tiles.observe('PLI', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'PLI: Replaces "Chamber of Global Commerce" row label with "COGC ({program type})".',
);

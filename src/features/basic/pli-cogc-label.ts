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
  for (const prefix of ['ADVERTISING_', 'WORKFORCE_']) {
    if (programType.startsWith(prefix)) {
      const suffix = programType.slice(prefix.length);
      return `COGC (${suffix.charAt(0) + suffix.slice(1).toLowerCase()})`;
    }
  }
  return `COGC (${programType.charAt(0) + programType.slice(1).toLowerCase()})`;
}

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.PlanetaryProjectsList.row), row => {
    const link = _$(row, C.Link.link);
    if (!link || link.textContent !== L.PlanetaryProjects.COGC()) {
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

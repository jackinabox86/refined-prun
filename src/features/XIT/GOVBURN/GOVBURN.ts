import GovBurnOverview from '@src/features/XIT/GOVBURN/GovBurnOverview.vue';
import GovBurnPlanetView from '@src/features/XIT/GOVBURN/GovBurnPlanetView.vue';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';

xit.add({
  command: 'GOVBURN',
  name: parameters => {
    if (parameters.length === 0) {
      return 'GOVERNMENT BURN';
    }
    // Join in case a naturalId/name was split by the XIT router.
    const parameter = parameters.join(' ');
    const planet = planetsStore.find(parameter);
    return `GOVERNMENT BURN - ${planet?.name ?? parameter}`;
  },
  description: 'Tracks planetary infrastructure upkeep.',
  optionalParameters: 'Planet Identifier',
  component: params => (params.length > 0 ? GovBurnPlanetView : GovBurnOverview),
});

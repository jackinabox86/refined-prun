import LOWSTRIFE from '@src/features/XIT/LOWSTRIFE/LOWSTRIFE.vue';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';

xit.add({
  command: 'LOWSTRIFE',
  name: parameters => {
    const site = sitesStore.getByPlanetNaturalIdOrName(parameters.join(' '));
    const name = site ? getEntityNameFromAddress(site.address) : parameters.join(' ');
    return `SHIP LOADING - ${name}`;
  },
  description:
    'Loads a ship with consumables for a fixed number of days and production inputs for as many days as fit, then fills the spare room with DW.',
  mandatoryParameters: 'Planet',
  component: () => LOWSTRIFE,
});

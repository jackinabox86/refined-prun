import FLT from './FLT.vue';
import { formatFltLocationFilter, resolveFltLocationFilter } from './location-filter';

xit.add({
  command: ['FLT', 'FLEET'],
  name: parameters => {
    const filter = resolveFltLocationFilter(parameters);
    if (filter !== undefined) {
      return `FLEET — ${formatFltLocationFilter(filter)}`;
    }
    return 'FLEET';
  },
  description:
    'Enhanced fleet table with detailed status, cargo, fuel, and quick actions. Optional system or planet identifier filters the list (e.g. XIT FLT ANT).',
  optionalParameters: 'System or Planet Identifier',
  component: () => FLT,
  bufferSize: [500, 300],
});

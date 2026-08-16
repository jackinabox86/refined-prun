import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { addCommandTransformer } from '@src/features/basic/correct-commands/correct-commands';

const exchangeShortcuts = new Map<string, string>([
  ['a', 'AI1'],
  ['ant', 'AI1'],
  ['antares', 'AI1'],
  ['b', 'CI1'],
  ['ben', 'CI1'],
  ['benten', 'CI1'],
  ['l', 'CI2'],
  ['arcl', 'CI2'],
  ['arclight', 'CI2'],
  ['i', 'IC1'],
  ['hor', 'IC1'],
  ['hortus', 'IC1'],
  ['h', 'NC2'],
  ['hub', 'NC2'],
  ['hubur', 'NC2'],
  ['m', 'NC1'],
  ['mor', 'NC1'],
  ['moria', 'NC1'],
]);

function transform(parts: string[]) {
  if (parts.length !== 2) {
    return;
  }

  const mic = exchangeShortcuts.get(parts[0].toLowerCase());
  if (mic === undefined) {
    return;
  }

  const material = materialsStore.getByTicker(parts[1]);
  if (material === undefined) {
    return;
  }

  parts.splice(0, parts.length, 'CXPO', `${material.ticker}.${mic}`);
}

function init() {
  addCommandTransformer(transform);
}

features.add(
  import.meta.url,
  init,
  'CXPO: Opens the place order buffer by typing an exchange shortcut and a material ticker, like "a dw".',
);

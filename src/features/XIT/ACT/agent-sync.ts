// Encodes/decodes ActionPackageData for posting into the refined-agent channel, and
// derives the "ready to run" list AGENT shows from the channel's message history.
import {
  agentChannelStore,
  maxMessageLength,
  postAgentMessage,
} from '@src/infrastructure/prun-api/data/agent-channel';
import { configurableValue, groupTargetPrefix } from '@src/features/XIT/ACT/shared-types';
import { deserializeStorage } from '@src/features/XIT/ACT/actions/utils';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';

const readyMaxAgeMs = 5 * 24 * 60 * 60 * 1000;

// Short structural keys - repeated on every action/group in a package.
const keyToSync = {
  actions: 'a',
  global: 'g',
  groups: 'r',
  name: 'n',
  type: 't',
  group: 'gr',
  origin: 'o',
  dest: 'd',
  exchange: 'x',
  materials: 'm',
  buyMissingFuel: 'bmf',
  buyPartial: 'bp',
  allowUnfilled: 'auf',
  priceLimits: 'pl',
  useCXInv: 'uci',
  useBaseInv: 'ubi',
  advanceDays: 'ad',
  days: 'dy',
  planet: 'p',
  skippable: 'sk',
  exclusions: 'ex',
  consumablesOnly: 'co',
} as const;
const keyFromSync = invert(keyToSync);

// Short codes for the fixed, bounded enums/sentinels that show up on every package.
const valueToSync = {
  [configurableValue]: '?',
  'CX Buy': 'CB',
  MTRA: 'MT',
  Refuel: 'RF',
  'CONT Ship': 'CS',
  'CONT Trade': 'CT',
  Manual: 'MN',
  Resupply: 'RS',
  Repair: 'RP',
  Paste: 'PS',
  AI1: 'A1',
  CI1: 'C1',
  CI2: 'C2',
  IC1: 'I1',
  NC1: 'N1',
  NC2: 'N2',
} as const;
const valueFromSync = invert(valueToSync);

function invert(map: Record<string, string>) {
  return Object.fromEntries(Object.entries(map).map(([full, short]) => [short, full]));
}

function remapKeysDeep(value: unknown, keyMap: Record<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map(item => remapKeysDeep(item, keyMap));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        keyMap[key] ?? key,
        remapKeysDeep(child, keyMap),
      ]),
    );
  }
  return value;
}

function remapValuesDeep(
  value: unknown,
  valueMap: Record<string, string>,
  transformString?: (value: string) => string,
): unknown {
  if (Array.isArray(value)) {
    return value.map(item => remapValuesDeep(item, valueMap, transformString));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        remapValuesDeep(child, valueMap, transformString),
      ]),
    );
  }
  if (typeof value === 'string') {
    const mapped = valueMap[value];
    if (mapped !== undefined) {
      return mapped;
    }
    return transformString ? transformString(value) : value;
  }
  return value;
}

// Origin/dest are built by serializeStorage() as "<display name> <Suffix>" (e.g.
// "Antares Warehouse"). deserializeStorage() resolves the name via *OrName lookups that
// accept a natural id interchangeably with the display name - so swapping in the natural
// id compacts these losslessly (no reverse step needed on expand) without hardcoding
// every base/warehouse name in the game.
const storageSuffixes = [' Base', ' Warehouse', ' Cargo', ' STL Store', ' FTL Store'] as const;

function compactStorageName(value: string): string {
  const suffix = storageSuffixes.find(x => value.endsWith(x));
  if (!suffix) {
    return value;
  }
  const store = deserializeStorage(value);
  if (!store) {
    return value;
  }
  const naturalId = getStorageNaturalId(store);
  return naturalId ? naturalId + suffix : value;
}

function getStorageNaturalId(store: PrunApi.Store): string | undefined {
  switch (store.type) {
    case 'STORE':
      return getEntityNaturalIdFromAddress(sitesStore.getById(store.addressableId)?.address);
    case 'WAREHOUSE_STORE':
      return getEntityNaturalIdFromAddress(warehousesStore.getById(store.addressableId)?.address);
    default:
      // Ship-based stores (SHIP_STORE/STL/FTL) are looked up by name only, with no
      // natural-id fallback - swapping the name here would break deserializeStorage.
      return undefined;
  }
}

interface AgentSyncEnvelope {
  // Kind: action-package.
  k: 'ap';
  v: 1;
  p: unknown;
}

export function compactActionPackageForSync(pkg: UserData.ActionPackageData): AgentSyncEnvelope {
  const withShortKeys = remapKeysDeep(pkg, keyToSync);
  const withShortValues = remapValuesDeep(withShortKeys, valueToSync, compactStorageName);
  return { k: 'ap', v: 1, p: withShortValues };
}

export function expandActionPackageFromSync(
  envelope: AgentSyncEnvelope,
): UserData.ActionPackageData {
  const withFullValues = remapValuesDeep(envelope.p, valueFromSync);
  return remapKeysDeep(withFullValues, keyFromSync) as UserData.ActionPackageData;
}

function parseAgentSyncEnvelope(text: string | null): AgentSyncEnvelope | undefined {
  if (!text) {
    return undefined;
  }
  try {
    const json = JSON.parse(text);
    if (json?.k === 'ap' && json?.v === 1) {
      return json as AgentSyncEnvelope;
    }
  } catch {
    // Not every message in the channel is one of ours - plain chat text fails to
    // parse and is ignored.
  }
  return undefined;
}

export async function postActionPackageToAgent(pkg: UserData.ActionPackageData) {
  const envelope = compactActionPackageForSync(pkg);
  const text = JSON.stringify(envelope);
  if (text.length > maxMessageLength) {
    throw new Error(
      `Action package too large to sync (${text.length} > ${maxMessageLength} chars).`,
    );
  }
  await postAgentMessage(text);
}

export interface AgentReadyPackage {
  messageId: string;
  pkg: UserData.ActionPackageData;
  ready: boolean;
}

// Whichever action references a store is what needs to be "ready" (landed, for a ship
// store) before the package makes sense to run - e.g. an Auto Offload MTRA whose origin
// is a ship's cargo hold that's still in flight.
function getReadyState(pkg: UserData.ActionPackageData): boolean {
  const storageValues = [pkg.actions.map(x => x.origin), pkg.actions.map(x => x.dest)]
    .flat()
    .filter((x): x is string => !!x && x !== configurableValue && !x.startsWith(groupTargetPrefix));

  for (const value of storageValues) {
    const store = deserializeStorage(value);
    if (store?.type !== 'SHIP_STORE') {
      continue;
    }
    const ship = shipsStore.getById(store.addressableId);
    if (ship?.flightId) {
      return false;
    }
  }
  return true;
}

export const agentReadyPackages = computed<AgentReadyPackage[]>(() => {
  const messages = agentChannelStore.all.value ?? [];
  const cutoff = Date.now() - readyMaxAgeMs;
  const result: AgentReadyPackage[] = [];
  for (const message of messages) {
    if (message.type !== 'CHAT' || message.time.timestamp < cutoff) {
      continue;
    }
    const envelope = parseAgentSyncEnvelope(message.message);
    if (!envelope) {
      continue;
    }
    const pkg = expandActionPackageFromSync(envelope);
    result.push({ messageId: message.messageId, pkg, ready: getReadyState(pkg) });
  }
  return result;
});

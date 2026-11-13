<script setup lang="ts">
import DaysCell from '@src/features/XIT/BURN/DaysCell.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import PrunButton from '@src/components/PrunButton.vue';
import { PlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';
import { store as planetContextMenu } from '@src/features/XIT/planet-context-menu';
import { useTileState } from '@src/features/XIT/BURN/tile-state';
import { ContractCargo, ContractCargoKind } from '@src/features/XIT/BURN/contract-cargo';
import fa from '@src/utils/font-awesome.module.css';

const { burn, contractCargo } = defineProps<{
  burn: PlanetBurn;
  contractCargo: ContractCargo[];
  hasMinimize?: boolean;
  minimized?: boolean;
  onClick: () => void;
}>();

const io = useTileState('io');
const excludeContracts = useTileState('excludeContracts');
const managed = useTileState('managed');

const includesContracts = computed(() => !excludeContracts.value.includes(burn.naturalId));
const isManaged = computed(() => managed.value.includes(burn.naturalId));

function toggle(list: string[], include: boolean) {
  return include ? [...list, burn.naturalId] : list.filter(x => x !== burn.naturalId);
}

function toggleContracts() {
  excludeContracts.value = toggle(excludeContracts.value, includesContracts.value);
}

function toggleManaged() {
  managed.value = toggle(managed.value, !isManaged.value);
}

const contractIcons = computed(() =>
  (['SHIPMENT', 'PURCHASE'] as ContractCargoKind[])
    .map(kind => ({ kind, cargo: contractCargo.filter(x => x.kind === kind) }))
    .filter(x => x.cargo.length > 0)
    .map(x => ({ kind: x.kind, tooltip: formatContractTooltip(x.kind, x.cargo) })),
);

function formatContractTooltip(kind: ContractCargoKind, cargo: ContractCargo[]) {
  const title = kind === 'SHIPMENT' ? 'Shipped by a partner' : 'Bought, not delivered yet';
  const lines = cargo.map(x => `${x.contractLocalId} ${x.partnerName}: ${x.amount} ${x.ticker}`);
  const action = includesContracts.value
    ? 'Included. Click to exclude contract cargo.'
    : 'Excluded. Click to include contract cargo.';
  return [title, ...lines, action].join('\n');
}

const managedTooltip = computed(() =>
  isManaged.value
    ? 'Managed base: production inputs are ignored. Click to count them.'
    : 'Click if someone else supplies the production inputs of this base.',
);
const days = computed(() => countDays(burn.burn));
const nameColspan = computed(() => (io.value ? 6 : 4));
</script>

<template>
  <tr :class="$style.row">
    <td
      :colspan="nameColspan"
      :class="$style.cell"
      @click="onClick"
      @contextmenu.prevent="burn.naturalId && planetContextMenu.showMenu($event, burn.naturalId)">
      <span v-if="hasMinimize" :class="$style.minimize">
        {{ minimized ? '+' : '-' }}
      </span>
      <span>{{ burn.planetName }}</span>
      <template v-if="burn.naturalId">
        <button
          v-for="icon in contractIcons"
          :key="icon.kind"
          type="button"
          :class="[
            fa.solid,
            $style.toggle,
            icon.kind === 'SHIPMENT' ? $style.shipment : $style.purchase,
            { [$style.off]: !includesContracts },
          ]"
          :data-tooltip="icon.tooltip"
          :aria-label="icon.tooltip"
          :aria-pressed="includesContracts"
          @click.stop="toggleContracts">
          {{ icon.kind === 'SHIPMENT' ? '\uf135' : '\uf07a' }}
        </button>
        <button
          type="button"
          :class="[fa.solid, $style.toggle, { [$style.off]: !isManaged }]"
          :data-tooltip="managedTooltip"
          :aria-label="managedTooltip"
          :aria-pressed="isManaged"
          @click.stop="toggleManaged">
          {{ '\uf2b5' }}
        </button>
      </template>
    </td>
    <DaysCell :days="days" />
    <td>
      <div :class="$style.buttons">
        <PrunButton dark inline @click="showBuffer(`BS ${burn.naturalId}`)">BS</PrunButton>
        <PrunButton dark inline @click="showBuffer(`INV ${burn.storeId.substring(0, 8)}`)">
          INV
        </PrunButton>
        <PrunButton dark inline @click="showBuffer(`XIT BURNACT ${burn.naturalId}`)"
          >ACT</PrunButton
        >
      </div>
    </td>
  </tr>
</template>

<style module>
.row {
  border-bottom: 1px solid #2b485a;
}

.cell {
  font-weight: bold;
  font-size: 12px;
  cursor: pointer;
}

.minimize {
  display: inline-block;
  width: 26px;
  text-align: center;
}

.toggle {
  float: right;
  margin-left: 6px;
  border: 0;
  padding: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  line-height: inherit;
  white-space: pre-line;
}

.shipment {
  color: #f7a600;
}

.purchase {
  color: #3fa2de;
}

.off {
  color: #666;
}

.buttons {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: 0.25rem;
}
</style>

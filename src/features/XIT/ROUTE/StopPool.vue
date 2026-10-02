<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import { ROUTE_STOP_MIME } from '@src/features/XIT/ROUTE/routes';

interface PoolEntry {
  key: string;
  label: string;
}

const { available, assigned, exchanges } = defineProps<{
  available: PoolEntry[];
  assigned: PoolEntry[];
  exchanges: PoolEntry[];
}>();

function onDragStart(event: DragEvent, key: string) {
  event.dataTransfer?.setData(ROUTE_STOP_MIME, key);
  event.dataTransfer?.setData('text/plain', key);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copyMove';
  }
  const button = (event.currentTarget as HTMLElement).querySelector('button');
  if (button && event.dataTransfer) {
    event.dataTransfer.setDragImage(button, button.offsetWidth / 2, button.offsetHeight / 2);
  }
}
</script>

<template>
  <div :class="$style.pool">
    <table :class="$style.table">
      <thead>
        <tr>
          <th>Stops</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="available.length > 0" :class="$style.labelRow">
          <td :class="$style.labelCell">Available</td>
        </tr>
        <tr v-for="entry in available" :key="entry.key" :class="$style.shipRow">
          <td :class="$style.shipCell">
            <div
              :class="$style.shipWrap"
              draggable="true"
              @dragstart="onDragStart($event, entry.key)">
              <PrunButton primary :class="$style.shipButton">
                <span :class="$style.shipLabel">{{ entry.label }}</span>
              </PrunButton>
            </div>
          </td>
        </tr>
        <tr v-if="assigned.length > 0" :class="$style.labelRow">
          <td :class="$style.labelCell">Assigned</td>
        </tr>
        <tr v-for="entry in assigned" :key="entry.key" :class="$style.shipRow">
          <td :class="$style.shipCell">
            <div
              :class="$style.shipWrap"
              draggable="true"
              @dragstart="onDragStart($event, entry.key)">
              <PrunButton primary :class="$style.shipButton">
                <span :class="$style.shipLabel">{{ entry.label }}</span>
              </PrunButton>
            </div>
          </td>
        </tr>
        <tr v-if="exchanges.length > 0" :class="$style.labelRow">
          <td :class="$style.labelCell">Exchanges</td>
        </tr>
        <tr v-for="entry in exchanges" :key="entry.key" :class="$style.shipRow">
          <td :class="$style.shipCell">
            <div
              :class="$style.shipWrap"
              draggable="true"
              @dragstart="onDragStart($event, entry.key)">
              <PrunButton primary :class="$style.shipButton">
                <span :class="$style.shipLabel">{{ entry.label }}</span>
              </PrunButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style module>
.pool {
  --poolMaxWidth: 110px;
  width: max-content;
  min-width: 10ch;
  max-width: var(--poolMaxWidth);
  flex: 0 0 auto;
  border-right: 1px solid #2b485a;
  box-sizing: border-box;
}

.table {
  border-collapse: collapse;
  width: 100%;
}

.table thead tr {
  border-bottom: 1px solid #2b485a;
  box-sizing: border-box;
}

.table thead th {
  text-align: center;
}

.shipRow {
  height: 24px;
  box-sizing: border-box;
  border-bottom: 1px solid #2b485a;
}

.shipCell {
  padding: 3px 2px;
  height: 24px;
  box-sizing: border-box;
}

.shipWrap {
  width: 100%;
  height: 100%;
  cursor: grab;
}

.shipButton {
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 0 4px;
  font-size: 11px;
  pointer-events: none;
  vertical-align: middle;
  box-sizing: border-box;
}

.shipLabel {
  display: block;
  width: 100%;
  max-width: calc(var(--poolMaxWidth) - 13px);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.labelRow {
  height: 24px;
  box-sizing: border-box;
  border-bottom: 1px solid #2b485a;
}

.labelCell {
  font-size: 11px;
  color: #888;
  text-align: center;
  padding: 0 4px;
  height: 24px;
  vertical-align: middle;
  box-sizing: border-box;
}
</style>

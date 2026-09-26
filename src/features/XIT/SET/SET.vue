<script setup lang="ts">
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { useXitCommand } from '@src/hooks/use-xit-command';
import Tabs, { Tab } from '@src/components/Tabs.vue';
import GAME from '@src/features/XIT/SET/GAME.vue';
import NOBUY from '@src/features/XIT/NOBUY/NOBUY.vue';
import FEAT from '@src/features/XIT/SET/FEAT.vue';
import FIN from '@src/features/XIT/SET/FIN.vue';
import BFR from '@src/features/XIT/SET/BFR.vue';

const tabs: Tab[] = [
  {
    id: 'GAME',
    label: 'Gameplay',
    component: GAME,
  },
  {
    id: 'ACT',
    label: 'Act',
    component: NOBUY,
  },
  {
    id: 'FEAT',
    label: 'Features',
    component: FEAT,
  },
  {
    id: 'FIN',
    label: 'Financial',
    component: FIN,
  },
  {
    id: 'BFR',
    label: 'Buffers',
    component: BFR,
  },
];

const parameters = useXitParameters();
const command = useXitCommand();
// XIT NOBUY stays as a shortcut onto this tab. The stored no-buy settings are unchanged.
const parameter = command.toUpperCase() === 'NOBUY' ? 'ACT' : parameters[0];

const activeTab = shallowRef(tabs.find(x => x.id === parameter?.toUpperCase()) ?? tabs[0]);
</script>

<template>
  <Tabs v-model="activeTab" :tabs="tabs" />
</template>

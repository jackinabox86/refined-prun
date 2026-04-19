<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import { isFactionContract } from '@src/features/XIT/CONTS/utils';
import fa from '@src/utils/font-awesome.module.css';
import coloredValue from '@src/infrastructure/prun-ui/css/colored-value.module.css';
import distrust from '@src/infrastructure/prun-ui/css/distrust.module.css';
import { isDistrustedPartner } from '@src/store/distrust';

const { contract } = defineProps<{ contract: PrunApi.Contract }>();

const distrustedClass = computed(() =>
  !isFactionContract(contract) && isDistrustedPartner(contract.partner)
    ? distrust.distrusted
    : undefined,
);
</script>

<template>
  <PrunLink v-if="isFactionContract(contract)" :command="`FA ${contract.partner.countryCode}`">
    <span :class="[fa.regular, coloredValue.warning]">{{ '\uf005' }}</span>
    {{ contract.partner.name }}
  </PrunLink>
  <PrunLink
    v-else-if="contract.partner.name"
    :command="`CO ${contract.partner.code}`"
    :class="distrustedClass">
    {{ contract.partner.name }}
  </PrunLink>
  <PrunLink
    v-else-if="contract.partner.code"
    :command="`CO ${contract.partner.code}`"
    :class="distrustedClass" />
  <div
    v-else-if="contract.partner.currency"
    data-tooltip="Refined PrUn is unable to fetch government information. Check the contract info for more details."
    data-tooltip-position="down"
    :class="$style.overrideTooltipStyle">
    Planetary Government
  </div>
  <div v-else>Unknown</div>
</template>

<style module>
.overrideTooltipStyle {
  display: block;
  padding: 0;
}
</style>

<script setup lang="ts">
import SectionHeader from '@src/components/SectionHeader.vue';
import PrunLink from '@src/components/PrunLink.vue';
import { channelIdentifier } from '@src/infrastructure/prun-api/data/agent-channel';
</script>

<template>
  <div :class="$style.help">
    <SectionHeader>What is XIT AGT?</SectionHeader>
    <div :class="$style.description">
      <p>
        XIT AGT (Agent) keeps action packages ready for later, such as unloading a resupply ship
        after it lands. It works with
        <PrunLink command="XIT DSP" inline>XIT DSP</PrunLink> (Dispatch) and
        <PrunLink command="XIT ACT" inline>XIT ACT</PrunLink> to help you deliver supplies, collect
        base output, and continue to the next stop.
      </p>
      <p>
        It is useful when one ship serves several bases, or when you switch devices. Your saved
        packages are available on each device with Refined PrUn, so you do not need to copy unload
        instructions between them.
      </p>
    </div>
    <SectionHeader>First-time setup</SectionHeader>
    <div :class="$style.description">
      Open <PrunLink command="COM" inline>COM</PrunLink>, click "new group", add no other members,
      and name the group "{{ channelIdentifier }}".
    </div>
    <SectionHeader>Use it with Dispatch</SectionHeader>
    <div :class="$style.description">
      <ol :class="$style.steps">
        <li>
          In <PrunLink command="XIT DSP" inline>XIT DSP</PrunLink>, assign a ship and enable AGT in
          the Agent column for each base you want it to serve.
        </li>
        <li>
          Run the dispatch package through to the end. It saves an "Auto Offload" package for each
          selected stop.
        </li>
        <li>
          After the ship lands, return to XIT AGT and click REFRESH. Click OPEN for that stop, then
          EXECUTE, and follow the ACT prompts to unload supplies and load base output.
        </li>
        <li>
          For a route with more stops, Agent fills in the next destination in SFC. Check and submit
          the flight there, then repeat after landing.
        </li>
      </ol>
    </div>
  </div>
</template>

<style module>
.description {
  line-height: 13px;
  padding: 4px;
  background-color: #26353e;
  margin-bottom: 5px;
}

.help p {
  margin: 0;
}

.help p + p {
  margin-top: 4px;
}

.steps {
  margin: 0;
  padding-inline-start: 18px;
}

.steps li + li {
  margin-top: 4px;
}
</style>

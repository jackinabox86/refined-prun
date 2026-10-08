<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
</script>

<template>
  <div :class="$style.container">
    <h1 :class="$style.title">Thank you for using Refined PrUn!</h1>
    <p>
      You can find a list of all of the XIT commands using
      <PrunLink inline command="XIT CMDS" />
    </p>
    <p>
      You can change settings using
      <PrunLink inline command="XIT SET" />
    </p>
    <p>
      For additional help, check
      <PrunLink inline command="XIT HELP" />
    </p>
    <p>
      You can change the feature set at any time using
      <PrunLink inline command="XIT SET FEAT" />
    </p>
  </div>
</template>

<style module>
.container {
  font-size: 12px;
  padding-left: 4px;
}

.title {
  font-weight: bold;
  display: block;
  font-size: 16px;
}
</style>

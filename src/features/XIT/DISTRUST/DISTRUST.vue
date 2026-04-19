<script setup lang="ts">
import { userData } from '@src/store/user-data';
import { setDistrustedUsernamesFromText } from '@src/store/distrust';

const text = ref(userData.distrustedUsernames.join('\n'));

watch(
  () => userData.distrustedUsernames,
  list => {
    const joined = list.join('\n');
    if (joined !== text.value.trim()) {
      text.value = joined;
    }
  },
);

function onInput() {
  setDistrustedUsernamesFromText(text.value);
}
</script>

<template>
  <div :class="$style.panel">
    <div :class="$style.hint">One username per line. Paste from a spreadsheet column directly.</div>
    <textarea
      v-model="text"
      spellcheck="false"
      :class="$style.textarea"
      placeholder="Euu&#10;AnotherName"
      @input="onInput" />
  </div>
</template>

<style module>
.panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 10px;
  gap: 6px;
  box-sizing: border-box;
}

.hint {
  color: var(--rp-color-text);
  font-size: 12px;
}

.textarea {
  flex: 1;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  resize: none;
  outline: none;
}
</style>

import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { focusElement, changeInputValue } from '@src/util';
import { sleep } from '@src/utils/sleep';
import { watchUntil } from '@src/utils/watch';
import { onNodeDisconnected } from '@src/utils/on-node-disconnected';
import {
  channelCommand,
  agentChannelStore,
  addLocalMessage,
  channelIdentifier,
} from '@src/infrastructure/prun-api/data/agent-channel';

const setupErrorMessage = `The "${channelIdentifier}" channel isn't set up - open COM, click "new group", add no other members, and name it "${channelIdentifier}".`;

async function waitForWindowClosed(window: Element) {
  await new Promise<void>(resolve => onNodeDisconnected(window, resolve));
}

// Verified send recipe for formless chat compose inputs - see docs/feature-patterns.md
// "Submitting a Formless Input Programmatically". Do not deviate from this sequence.
async function verifiedSend(input: HTMLInputElement, text: string) {
  focusElement(input);
  changeInputValue(input, text);
  await sleep(300);
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    const event = new KeyboardEvent(type, {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'keyCode', { get: () => 13 });
    Object.defineProperty(event, 'which', { get: () => 13 });
    input.dispatchEvent(event);
  }
  const deadline = Date.now() + 3000;
  while (input.value !== '' && Date.now() < deadline) {
    await sleep(100);
  }
  if (input.value !== '') {
    throw new Error('The game did not accept the message (chat input never cleared).');
  }
}

// Input-clear only proves the client accepted the keystroke. The game tags the sent
// message's C.Message.text span with C.Message.unconfirmed until the server acks it
// (~100-200ms); wait for that class to drop before treating the post as real.
async function waitForServerConfirmation(window: Element, text: string) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const messages = _$(window, C.MessageList.messages);
    if (messages) {
      const texts = _$$(messages, C.Message.text);
      for (let i = texts.length - 1; i >= 0; i--) {
        const span = texts[i];
        if (span.textContent === text && !span.classList.contains(C.Message.unconfirmed)) {
          return;
        }
      }
    }
    await sleep(100);
  }
  throw new Error('The game did not confirm the message was received by the server.');
}

async function waitForComposePrompt(window: Element) {
  const prompt = await Promise.race([
    $(window, C.Channel.prompt),
    (async () => {
      await watchUntil(agentChannelStore.inaccessible);
      return undefined;
    })(),
  ]);
  if (!prompt) {
    throw new Error(setupErrorMessage);
  }
  return prompt;
}

// Prefill + verified-send recipe + server-ack wait + local store fold on an already-open channel.
export async function postMessageToOpenChannel(
  window: Element,
  input: HTMLInputElement,
  text: string,
) {
  await verifiedSend(input, text);
  await waitForServerConfirmation(window, text);
  addLocalMessage(text);
}

// Opens the channel buffer visibly with `text` drafted in the compose input. The player
// presses Enter themselves. In the background, once the input clears while the buffer is
// still open, fold the draft into the local store so the dismissal takes effect this
// session without a refetch.
//
// Assumption: if the player edits the draft before sending, the local fold may not match
// the server copy; the authoritative copy wins on next reload.
export async function openAgentChannelWithDraft(text: string) {
  const window = await showBuffer(channelCommand, {
    force: true,
  });
  const prompt = await waitForComposePrompt(window);
  const input = _$(prompt, 'input') as HTMLInputElement;
  focusElement(input);
  changeInputValue(input, text);

  // Do not block the caller - poll in the background until send or close.
  void (async () => {
    let disconnected = false;
    onNodeDisconnected(window, () => {
      disconnected = true;
    });
    while (!disconnected && input.value !== '') {
      await sleep(100);
    }
    if (!disconnected && input.value === '') {
      addLocalMessage(text);
    }
  })();
}

// Posts a raw string to the channel via the compose input (no <form> exists on it, so
// this dispatches real Enter key events instead of the requestSubmit() pattern buffers.ts
// uses for command-entry inputs). A bare keydown right after filling the input is silently
// dropped - the game's handler needs a beat after the value change plus the full
// keydown/keypress/keyup sequence. Legacy keyCode/which getters are patched onto the
// events because the game still reads them. Success is verified by polling until the
// compose input clears and the message's unconfirmed class is removed by the server ack.
export async function postAgentMessage(text: string) {
  const posted = ref(false);
  const window = await showBuffer(channelCommand, {
    force: true,
    autoClose: true,
    closeWhen: computed(() => posted.value),
  });
  try {
    const prompt = await waitForComposePrompt(window);
    const input = _$(prompt, 'input') as HTMLInputElement;
    await postMessageToOpenChannel(window, input, text);
  } finally {
    posted.value = true;
  }
  await waitForWindowClosed(window);
}

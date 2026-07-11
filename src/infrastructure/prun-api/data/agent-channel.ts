import { createEntityStore } from '@src/infrastructure/prun-api/data/create-entity-store';
import { onApiMessage } from '@src/infrastructure/prun-api/data/api-messages';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { focusElement, changeInputValue } from '@src/util';
import { sleep } from '@src/utils/sleep';
import { watchUntil } from '@src/utils/watch';
import { onNodeDisconnected } from '@src/utils/on-node-disconnected';

// "refined-agent" is a private GROUP channel with no other members, repurposed as a
// cross-device data-sync channel. Opening it via an invisible buffer follows the same
// ToS-cleared pattern as XIT BURN (see docs/contributing.md "Server Communication & ToS").
export const channelIdentifier = 'refined-agent';
export const channelCommand = `COMG ${channelIdentifier}`;

// Observed on every captured channel's CHANNEL_DATA payload; the game has no per-message
// API to query this, so callers must stay under it themselves before posting.
export const maxMessageLength = 1000;

const store = createEntityStore<PrunApi.ChannelMessage>({ selectId: x => x.messageId });
const state = store.state;

const channelId = ref<string>();
const received = ref(false);
const inaccessible = ref(false);

const setupErrorMessage = `The "${channelIdentifier}" channel isn't set up - open COM, click "new group", add no other members, and name it "${channelIdentifier}".`;

onApiMessage({
  CLIENT_CONNECTION_OPENED() {
    channelId.value = undefined;
    inaccessible.value = false;
  },
  CHANNEL_MESSAGE_LIST(data: PrunApi.ChannelMessageList) {
    // Ignore CHANNEL_MESSAGE_LIST pushes from unrelated channels the user has open elsewhere.
    if (channelId.value !== undefined && data.channelId !== channelId.value) {
      return;
    }
    channelId.value = data.channelId;
    inaccessible.value = false;
    store.setAll(data.messages);
    store.setFetched();
    received.value = true;
  },
  // Fires with channelId: null, joined: false when the channel doesn't exist yet or
  // the current user isn't a member of it.
  CHANNEL_CLIENT_MEMBERSHIP(data: PrunApi.ChannelClientMembership) {
    if (data.identifier !== channelIdentifier || data.joined) {
      return;
    }
    inaccessible.value = true;
    received.value = true;
  },
});

export const agentChannelStore = {
  ...state,
  channelId,
  inaccessible,
};

async function waitForWindowClosed(window: Element) {
  await new Promise<void>(resolve => onNodeDisconnected(window, resolve));
}

// The server won't push this back as a fresh CHANNEL_MESSAGE_LIST within the same
// session (see fetchAgentChannel), but we already know exactly what we just sent -
// fold it into the store directly so this session's own posts are visible without
// waiting on a refetch that will never come. A real reload picks up the authoritative
// copy (with a real messageId) the normal way.
function addLocalMessage(text: string) {
  store.addOne({
    messageId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'CHAT',
    sender: null,
    message: text,
    time: { timestamp: Date.now() },
    channelId: channelId.value ?? '',
    deletingUser: null,
  });
  store.setFetched();
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

async function waitForComposePrompt(window: Element) {
  const prompt = await Promise.race([
    $(window, C.Channel.prompt),
    (async () => {
      await watchUntil(inaccessible);
      return undefined;
    })(),
  ]);
  if (!prompt) {
    throw new Error(setupErrorMessage);
  }
  return prompt;
}

// The game only sends the channel's full message history once per connection - verified
// live: reopening the channel a second time in the same session produces zero inbound
// traffic (not a timing issue, the server/client just doesn't resend it), and even the
// rendered DOM doesn't reflect the full history on a second open, only whatever arrived
// live during that particular open. So this only ever does the real fetch once per
// session; after that it's a no-op and callers rely on postAgentMessage() folding
// locally-sent messages straight into the store instead of re-fetching for them.
export async function fetchAgentChannel() {
  if (state.fetched.value || inaccessible.value) {
    return;
  }
  received.value = false;
  const window = await showBuffer(channelCommand, {
    force: true,
    autoClose: true,
    closeWhen: computed(() => received.value),
  });
  await watchUntil(received);
  await waitForWindowClosed(window);
}

// Opens the channel buffer visibly and returns its compose input for a follow-up send.
// Leaves the buffer open (no autoClose).
export async function openAgentChannel() {
  const window = await showBuffer(channelCommand, {
    force: true,
  });
  const prompt = await waitForComposePrompt(window);
  const input = _$(prompt, 'input') as HTMLInputElement;
  return { window, input };
}

// Prefill + verified-send recipe + local store fold on an already-open channel.
export async function postMessageToOpenChannel(input: HTMLInputElement, text: string) {
  await verifiedSend(input, text);
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
// compose input clears (the game clears it only after an actual send).
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
    await postMessageToOpenChannel(input, text);
  } finally {
    posted.value = true;
  }
  await waitForWindowClosed(window);
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch } from '@src/infrastructure/prun-api/data/api-messages';
import {
  agentChannelStore,
  channelIdentifier,
  fetchAgentChannel,
} from '@src/infrastructure/prun-api/data/agent-channel';
import { agentReadyPackages } from '@src/features/XIT/ACT/agent-sync';

const mocks = vi.hoisted(() => ({ showBuffer: vi.fn() }));

vi.mock('@src/infrastructure/prun-ui/buffers', () => ({ showBuffer: mocks.showBuffer }));

function packageMessage(id: string, channelId: string): PrunApi.ChannelMessage {
  return {
    messageId: `message-${id}`,
    type: 'CHAT',
    sender: null,
    message: JSON.stringify({
      k: 'ap',
      v: 1,
      i: id,
      p: { g: { n: 'Auto Offload' }, r: [], a: [] },
    }),
    time: { timestamp: Date.now() },
    channelId,
    deletingUser: null,
  };
}

function channelMessages(channelId: string, messages: PrunApi.ChannelMessage[]) {
  return {
    type: 'CHANNEL_MESSAGE_LIST',
    data: { channelId, messages, hasMore: false },
  };
}

function channelMembership(channelId: string) {
  return {
    type: 'CHANNEL_CLIENT_MEMBERSHIP',
    data: {
      type: 'GROUP',
      identifier: channelIdentifier,
      channelId,
      joined: true,
      muted: false,
      readUntil: { timestamp: Date.now() },
      lastActivity: { timestamp: Date.now() },
    },
  };
}

describe('agent channel ingestion', () => {
  beforeEach(() => {
    mocks.showBuffer.mockReset();
    dispatch({ type: 'CLIENT_CONNECTION_OPENED' });
  });

  it('ignores unrelated history before ingesting a requested refined-agent channel', async () => {
    dispatch(channelMessages('other-channel', [packageMessage('wrong', 'other-channel')]));

    expect(agentChannelStore.fetched.value).toBe(false);
    expect(agentReadyPackages.value).toEqual([]);

    const targetChannel = 'refined-agent-channel';
    mocks.showBuffer.mockImplementation(async () => {
      dispatch(
        channelMessages(
          targetChannel,
          ['a2-1', 'a2-2', 'a2-3', 'a2-4'].map(x => packageMessage(x, targetChannel)),
        ),
      );
      return { isConnected: false } as Element;
    });
    await fetchAgentChannel();

    expect(agentChannelStore.channelId.value).toBe(targetChannel);
    expect(agentReadyPackages.value.map(x => x.id)).toEqual(['a2-1', 'a2-2', 'a2-3', 'a2-4']);
  });

  it('uses refined-agent membership to identify later history', () => {
    const targetChannel = 'refined-agent-channel';
    dispatch(channelMembership(targetChannel));
    dispatch(channelMessages(targetChannel, [packageMessage('a2', targetChannel)]));

    expect(agentChannelStore.channelId.value).toBe(targetChannel);
    expect(agentReadyPackages.value.map(x => x.id)).toEqual(['a2']);
  });
});

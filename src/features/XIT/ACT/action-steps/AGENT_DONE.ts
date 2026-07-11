import { act } from '@src/features/XIT/ACT/act-registry';
import {
  openAgentChannel,
  postMessageToOpenChannel,
} from '@src/infrastructure/prun-api/data/agent-channel';
import { changeInputValue, focusElement } from '@src/util';

interface Data {
  id: string;
}

export const AGENT_DONE = act.addActionStep<Data>({
  type: 'AGENT_DONE',
  description: data => `Post completion marker [${data.id}] to the agent channel`,
  execute: async ctx => {
    const { data, waitAct, complete, fail } = ctx;
    const { id } = data;

    await waitAct('Open agent channel?');
    let input: HTMLInputElement;
    try {
      ({ input } = await openAgentChannel());
      // Prefill so the player can see the marker before confirming the send.
      focusElement(input);
      changeInputValue(input, id);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
      return;
    }

    await waitAct(`Post completion marker ${id}?`);
    try {
      await postMessageToOpenChannel(input, id);
    } catch (e) {
      // Leave the channel buffer open on failure so the player can finish manually.
      fail(e instanceof Error ? e.message : String(e));
      return;
    }
    complete();
  },
});

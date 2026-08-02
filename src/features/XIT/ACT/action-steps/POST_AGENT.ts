import { act } from '@src/features/XIT/ACT/act-registry';
import { buildAgentPackageMessage } from '@src/features/XIT/ACT/agent-sync';
import { postAgentMessage } from '@src/infrastructure/prun-ui/agent-channel-messaging';

interface Data {
  pkg: UserData.ActionPackageData;
  // Pre-allocated id (e.g. chain member "c11-2"); omit to auto-generate.
  id?: string;
}

export const POST_AGENT = act.addActionStep<Data>({
  type: 'POST_AGENT',
  description: data => `Post [${data.pkg.global.name}] package to the agent channel`,
  execute: async ctx => {
    const { data, waitAct, complete, skip, log } = ctx;
    // Chained Auto Offload runs post several packages to the same game chat channel
    // back-to-back; without a gap here, rapid-fire real chat sends can trip the
    // game's own flood protection and the ack never clears in time (see
    // waitForServerConfirmation in agent-channel-messaging.ts).
    await waitAct(undefined, { actDelayMs: 2000 });
    const { id, text } = await buildAgentPackageMessage(data.pkg, data.id);
    try {
      await postAgentMessage(text);
    } catch (e) {
      const name = data.pkg.global.name ?? 'package';
      const message = e instanceof Error ? e.message : String(e);
      log.error(`Failed to post [${name}] as [${id}]: ${message}`);
      log.error('Chain continued; post this package manually to the refined-agent channel:');
      log.label(text);
      skip({ silent: true });
      return;
    }
    log.info(`Posted package as [${id}]`);
    complete();
  },
});

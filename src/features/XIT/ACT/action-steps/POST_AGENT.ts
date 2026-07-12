import { act } from '@src/features/XIT/ACT/act-registry';
import { postActionPackageToAgent } from '@src/features/XIT/ACT/agent-sync';

interface Data {
  pkg: UserData.ActionPackageData;
  // Pre-allocated id (e.g. chain member "c11-2"); omit to auto-generate.
  id?: string;
}

export const POST_AGENT = act.addActionStep<Data>({
  type: 'POST_AGENT',
  description: data => `Post [${data.pkg.global.name}] package to the agent channel`,
  execute: async ctx => {
    const { data, waitAct, complete, log } = ctx;
    await waitAct();
    const id = await postActionPackageToAgent(data.pkg, data.id);
    log.info(`Posted package as [${id}]`);
    complete();
  },
});

import { act } from '@src/features/XIT/ACT/act-registry';
import { postActionPackageToAgent } from '@src/features/XIT/ACT/agent-sync';

interface Data {
  pkg: UserData.ActionPackageData;
}

export const POST_AGENT = act.addActionStep<Data>({
  type: 'POST_AGENT',
  description: data => `Post [${data.pkg.global.name}] package to the agent channel`,
  execute: async ctx => {
    const { data, waitAct, complete, log } = ctx;
    await waitAct();
    const id = await postActionPackageToAgent(data.pkg);
    log.info(`Posted package as [${id}]`);
    complete();
  },
});

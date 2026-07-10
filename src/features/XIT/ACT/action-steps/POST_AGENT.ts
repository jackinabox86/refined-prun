import { act } from '@src/features/XIT/ACT/act-registry';
import { postActionPackageToAgent } from '@src/features/XIT/ACT/agent-sync';

interface Data {
  pkg: UserData.ActionPackageData;
}

export const POST_AGENT = act.addActionStep<Data>({
  type: 'POST_AGENT',
  description: data => `Post [${data.pkg.global.name}] package to the agent channel`,
  execute: async ctx => {
    const { data, waitAct, complete } = ctx;
    await waitAct();
    await postActionPackageToAgent(data.pkg);
    complete();
  },
});

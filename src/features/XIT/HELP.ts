import HELP from '@src/features/XIT/HELP.vue';
import AgentHelp from '@src/features/XIT/HELP/AgentHelp.vue';

xit.add({
  command: 'HELP',
  name: 'HELP',
  description: 'Useful information to get started with Refined PrUn.',
  optionalParameters: 'Command',
  component: params => {
    switch (params[0]?.toUpperCase()) {
      case 'AGT':
      case 'AGENT':
        return AgentHelp;
      default:
        return HELP;
    }
  },
});

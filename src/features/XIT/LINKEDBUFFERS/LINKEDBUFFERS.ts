import LINKEDBUFFERS from '@src/features/XIT/LINKEDBUFFERS/LINKEDBUFFERS.vue';
import { userData } from '@src/store/user-data';
import { isEmpty } from 'ts-extras';

xit.add({
  command: ['LINKEDBUFFERS', 'LB'],
  name: parameters => {
    if (isEmpty(parameters)) {
      return 'LINKED BUFFERS';
    }
    const preset =
      userData.linkedBuffersPresets.find(x => x.id.startsWith(parameters[0])) ??
      userData.linkedBuffersPresets.find(x => x.name === parameters.join(' '));
    return preset ? `LB: ${preset.name}` : 'LINKED BUFFERS';
  },
  description: 'Opens a dashboard with linked child buffers driven by a text input.',
  optionalParameters: 'Preset Name',
  component: () => LINKEDBUFFERS,
  bufferSize: [900, 500],
});

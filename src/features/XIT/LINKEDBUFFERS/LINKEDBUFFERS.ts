import LINKEDBUFFERS from '@src/features/XIT/LINKEDBUFFERS/LINKEDBUFFERS.vue';
import EditPreset from '@src/features/XIT/LINKEDBUFFERS/EditPreset.vue';
import { userData } from '@src/store/user-data';
import { isEmpty } from 'ts-extras';

function findPreset(parameters: string[]) {
  const byId = userData.linkedBuffersPresets.find(x => x.id.startsWith(parameters[0]));
  if (byId) {
    return byId;
  }
  return userData.linkedBuffersPresets.find(x => x.name === parameters.join(' '));
}

function isEditMode(parameters: string[]) {
  return parameters[0]?.toUpperCase() === 'EDIT';
}

xit.add({
  command: ['LINKEDBUFFERS', 'LB'],
  name: parameters => {
    if (isEmpty(parameters)) {
      return 'LINKED BUFFERS';
    }
    if (isEditMode(parameters)) {
      const preset = findPreset(parameters.slice(1));
      return preset ? `LB EDIT: ${preset.name}` : 'LB EDIT';
    }
    const preset = findPreset(parameters);
    return preset ? `LB: ${preset.name}` : 'LINKED BUFFERS';
  },
  description: 'Opens a dashboard with linked child buffers driven by a text input.',
  optionalParameters: 'Preset Name',
  component: parameters => {
    if (isEditMode(parameters)) {
      return EditPreset;
    }
    return LINKEDBUFFERS;
  },
  bufferSize: [205, 400],
});

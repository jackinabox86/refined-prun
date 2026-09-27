import FLTBUTTONS from './FLTBUTTONS.vue';

xit.add({
  command: ['FLTBUTTONS', 'FLTCOLORS'],
  name: 'FLT BUTTON COLORS',
  description: 'Pick XIT FLT unload-button colors for base/CX ships with empty or loaded cargo.',
  component: () => FLTBUTTONS,
  bufferSize: [360, 280],
});

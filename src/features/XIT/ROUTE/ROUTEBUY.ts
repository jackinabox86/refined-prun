import '@src/features/XIT/ACT/actions/cx-buy/cx-buy';
import '@src/features/XIT/ACT/material-groups/manual/manual';
import '@src/features/XIT/ROUTE/RT_ASSIGN';

import RouteBuyWindow from '@src/features/XIT/ROUTE/RouteBuyWindow.vue';

xit.add({
  command: 'ROUTEBUY',
  name: 'ROUTE BUY',
  description: "Buys a non-looping route's shortfall, then assigns its ship.",
  component: () => RouteBuyWindow,
  bufferSize: [640, 480],
});

import '@src/features/XIT/ACT/actions/cx-buy/cx-buy';
import '@src/features/XIT/ACT/material-groups/manual/manual';

import RestockWindow from '@src/features/XIT/ROUTE/RestockWindow.vue';

xit.add({
  command: 'ROUTESUPPLY',
  name: 'ROUTE RESTOCK',
  description: 'Buys the departure loads of route laps due within the route resupply days.',
  component: () => RestockWindow,
});

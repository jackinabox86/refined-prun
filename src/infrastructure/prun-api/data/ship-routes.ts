import { onApiMessage } from '@src/infrastructure/prun-api/data/api-messages';

// One execution per ship on a route. The game pushes SHIP_ROUTES_EXECUTION on every
// state change even when no full list has arrived, so a single push counts as data.
// The full list (SHIP_ROUTES_EXECUTIONS) comes only after RT, RTE or FLT opens, and
// again after an execution ends; it drops finished one-way routes.
const executions = shallowRef({} as Record<string, PrunApi.ShipRouteExecution>);
const fetched = ref(false);

onApiMessage({
  CLIENT_CONNECTION_OPENED() {
    executions.value = {};
    fetched.value = false;
  },
  SHIP_ROUTES_EXECUTIONS(data: { executions: PrunApi.ShipRouteExecution[] }) {
    const next: Record<string, PrunApi.ShipRouteExecution> = {};
    for (const execution of data.executions) {
      next[execution.shipId] = execution;
    }
    executions.value = next;
    fetched.value = true;
  },
  SHIP_ROUTES_EXECUTION(data: PrunApi.ShipRouteExecution) {
    executions.value = { ...executions.value, [data.shipId]: data };
  },
});

export const shipRoutesStore = {
  // True once a full list has arrived. Until then only ships that changed state are known.
  fetched,
  all: computed(() => Object.values(executions.value)),
  getByShipId: (shipId: string) => executions.value[shipId],
};

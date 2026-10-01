import { blueprintsStore } from '@src/infrastructure/prun-api/data/blueprints';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

const loadTimeoutMs = 15_000;

// Focusing a BLU buffer that is already open does not ask for the list again.
// After an extension reload the game can still show that buffer while this
// store is empty, so the load always submits a new BLU command.
export async function ensureBlueprintsFetched() {
  const store = blueprintsStore.peek();
  if (store.fetched.value) {
    return true;
  }
  const giveUp = ref(false);
  const opened = (async () => {
    try {
      await showBuffer('BLU', {
        force: true,
        autoClose: true,
        closeWhen: computed(() => store.fetched.value || giveUp.value),
      });
    } catch {
      // The fetch wait below reports the failure if the buffer never opens.
    }
  })();
  const fetched = waitForFetched(store.fetched, loadTimeoutMs);
  const [loaded] = await Promise.all([fetched, opened]);
  if (!loaded) {
    giveUp.value = true;
  }
  return loaded;
}

function waitForFetched(fetched: Ref<boolean>, timeoutMs: number) {
  return new Promise<boolean>(resolve => {
    if (fetched.value) {
      resolve(true);
      return;
    }
    let stop: () => void = () => undefined;
    const timer = setTimeout(() => {
      stop();
      resolve(false);
    }, timeoutMs);
    stop = watch(fetched, value => {
      if (!value) {
        return;
      }
      clearTimeout(timer);
      stop();
      resolve(true);
    });
  });
}

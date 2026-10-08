import { finishApiInitialization, initializeApi } from '@src/infrastructure/prun-api';
import { initializeUI } from '@src/infrastructure/prun-ui';
import { saveUserData } from '@src/infrastructure/storage/user-data-serializer';
import { initializeUserData } from '@src/store';
import { defaultFreshInstallToFullMode } from '@src/store/fresh-install';
import { initAudioInterceptor } from '@src/infrastructure/prun-ui/audio-interceptor';
import PmmgMigrationGuide from '@src/components/PmmgMigrationGuide.vue';

async function main() {
  try {
    initAudioInterceptor();
    await initializeApi();
    await initializeUI();

    if (window['PMMG_COLLECTOR_HAS_RUN']) {
      createFragmentApp(PmmgMigrationGuide).before(await $(document, C.App.container));
      finishApiInitialization();
      return;
    }

    console.log(`Refined PrUn ${config.version}`);
    initializeUserData();
    // Mode must be FULL before features.init so advanced features load on the
    // first start. The save has to finish first; a later reload is too late.
    if (defaultFreshInstallToFullMode()) {
      await saveUserData();
    }
    features.init();
    xit.init();
  } finally {
    finishApiInitialization();
  }
}

void main();

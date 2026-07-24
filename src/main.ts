import { finishApiInitialization, initializeApi } from '@src/infrastructure/prun-api';
import { initializeUI } from '@src/infrastructure/prun-ui';
import { initializeUserData } from '@src/store';
import { initAudioInterceptor } from '@src/infrastructure/prun-ui/audio-interceptor';
import PmmgMigrationGuide from '@src/components/PmmgMigrationGuide.vue';
import { toggleGame3D } from '@src/game-3d-launcher';

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
    features.init();
    xit.init();

    // Lazy 3D mode spike — three.js must never load unless a trigger fires.
    document.addEventListener('keydown', e => {
      if (!e.ctrlKey || !e.altKey || e.key !== '3') {
        return;
      }
      e.preventDefault();
      void toggleGame3D();
    });
  } finally {
    finishApiInitialization();
  }
}

void main();

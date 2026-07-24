import { finishApiInitialization, initializeApi } from '@src/infrastructure/prun-api';
import { initializeUI } from '@src/infrastructure/prun-ui';
import { initializeUserData } from '@src/store';
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
    features.init();
    xit.init();

    // Lazy 3D mode spike — three.js must never load unless the hotkey is used.
    document.addEventListener('keydown', e => {
      if (!e.ctrlKey || !e.altKey || e.key !== '3') {
        return;
      }
      e.preventDefault();
      void (async () => {
        try {
          const { launchGame3D } = await import('@src/game-3d');
          launchGame3D();
        } catch (err) {
          console.error('[game-3d] failed to launch', err);
        }
      })();
    });
  } finally {
    finishApiInitialization();
  }
}

void main();

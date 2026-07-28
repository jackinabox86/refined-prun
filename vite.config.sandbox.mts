// Dev-only Vite config for the 3D Game Mode visual-iteration sandbox
// (src/game-3d/sandbox/). Deliberately separate from vite.config.mts (which builds the
// real extension in lib mode) so nothing here can affect that build. Duplicates the
// alias/unimport setup from vite.config.mts on purpose rather than importing from it —
// see docs/browser-testing-3d.md for why. If the auto-import list there changes, mirror
// it here too.
import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import unimport from 'unimport/unplugin';

const srcDir = resolve(__dirname, 'src');
const sandboxDir = resolve(srcDir, 'game-3d/sandbox');

export default defineConfig({
  root: sandboxDir,
  resolve: {
    alias: {
      '@src': srcDir,
      '~': resolve(srcDir, 'assets'),
    },
  },
  server: {
    port: 5183,
    strictPort: true,
  },
  plugins: [
    vue(),
    vueJsx(),
    unimport.vite({
      presets: [
        'vue',
        {
          from: '@src/utils/select-dom',
          imports: ['$', '$$', '_$', '_$$'],
        },
      ],
      imports: [
        { name: 'C', from: '@src/infrastructure/prun-ui/prun-css' },
        { name: 'subscribe', from: '@src/utils/observable' },
        { name: 'default', as: 'tiles', from: '@src/infrastructure/prun-ui/tiles' },
        { name: 'default', as: 'features', from: '@src/features/feature-registry' },
        { name: 'default', as: 'xit', from: '@src/features/XIT/xit-registry' },
        { name: 'default', as: 'config', from: '@src/infrastructure/shell/config' },
        { name: 'createFragmentApp', from: '@src/utils/vue-fragment-app' },
        { name: 'applyCssRule', from: '@src/infrastructure/prun-ui/refined-prun-css' },
        { name: 'sumBy', from: '@src/utils/sum-by' },
      ],
      // Own file so `vite dev` never rewrites the tracked src/types/unimport.d.ts.
      dts: resolve(sandboxDir, '.unimport.sandbox.d.ts'),
      addons: {
        vueTemplate: true,
      },
    }),
  ],
  define: {
    // This define is needed for vue npm packages
    'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
  },
});

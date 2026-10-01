import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(root, 'src');

const contentScripts = ['refined-prun-prepare', 'refined-prun-startup'] as const;

describe('content script entries', () => {
  it('emits classic scripts with no top-level import in a dev build', async () => {
    // Manifest content scripts are classic scripts. This lib build is ES with
    // preserveModules, so a cross-file import is emitted as a bare import and
    // the script fails to parse. See vite.config.mts.
    const configSource = await readFile(resolve(root, 'vite.config.mts'), 'utf8');
    expect(configSource).toContain("formats: ['es']");
    expect(configSource).toContain('preserveModules: true');

    const outDir = await mkdtemp(resolve(tmpdir(), 'rpr-content-scripts-'));
    try {
      await build({
        configFile: false,
        mode: 'development',
        logLevel: 'silent',
        publicDir: false,
        build: {
          outDir,
          emptyOutDir: true,
          minify: false,
          sourcemap: false,
          reportCompressedSize: false,
          lib: {
            entry: {
              'refined-prun-prepare': resolve(srcDir, 'refined-prun-prepare.ts'),
              'refined-prun-startup': resolve(srcDir, 'refined-prun-startup.ts'),
            },
            formats: ['es'],
          },
          rollupOptions: {
            external: ['chrome'],
            output: {
              preserveModules: true,
              preserveModulesRoot: 'source',
              entryFileNames: chunk => `${chunk.name}.js`,
            },
          },
        },
      });

      for (const name of contentScripts) {
        const filename = `${name}.js`;
        const code = await readFile(resolve(outDir, filename), 'utf8');
        const importLines = code.match(/^\s*import\s/gm) ?? [];
        expect(importLines, filename).toEqual([]);
        expect(() => new Script(code, { filename }), code.split('\n')[0]).not.toThrow();
      }
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }, 60_000);
});

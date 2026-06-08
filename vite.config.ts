import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { version as pkgVersion } from './package.json';

// Emit dist/version.json at build time so /pub/version.json returns real
// JSON instead of the SPA-fallback index.html. The /services landing
// page on courthive.net fetches this to display the currently-deployed
// courthive-public build. Same shape as TMX + courthive-console.
const BUILD_COMMIT = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
})();
const emitVersionJson = (): Plugin => ({
  name: 'public-emit-version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source:
        JSON.stringify({ version: pkgVersion, commit: BUILD_COMMIT, builtAt: new Date().toISOString() }) + '\n',
    });
  },
});

export default function viteConfig({ mode }: { mode: string }) {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
    server: {
      port: 5174,
      strictPort: true,
    },
    build: {
      sourcemap: true,
      rolldownOptions: {
        onwarn(warning, defaultHandler) {
          // Suppress hotkeys-js CJS/ESM dual-export warning — harmless packaging issue
          if (warning.code === 'COMMONJS_VARIABLE_IN_ESM' && warning.message?.includes('hotkeys-js')) return;
          defaultHandler(warning);
        },
      },
    },
    plugins: [svelte(), emitVersionJson()],
    base: BASE_URL,
    resolve: {
      tsconfigPaths: true,
      alias: {
        'tods-competition-factory': path.resolve(__dirname, 'node_modules/tods-competition-factory'),
      },
    },
    optimizeDeps: {
      include: ['hotkeys-js'],
    },
  });
};

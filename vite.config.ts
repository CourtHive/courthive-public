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
        // Explicit `src` alias so `src/...` baseUrl imports resolve in BOTH .ts
        // and .svelte files. vite 8.1.0 regressed `resolve.tsconfigPaths` for
        // Svelte-component imports (`src/common/context` failed to resolve from
        // TournamentList.svelte under rolldown); an explicit alias is processed
        // by vite core for every import, sidestepping that bug.
        src: path.resolve(__dirname, 'src'),
        'tods-competition-factory': path.resolve(__dirname, 'node_modules/tods-competition-factory'),
      },
    },
    optimizeDeps: {
      // hotkeys-js is CJS; @courthive/provider-config ships CommonJS and is
      // `link:`-overridden in dev, so vite serves it raw via @fs and skips the
      // CJS→ESM interop it applies to node_modules deps — pre-bundle it here so
      // named ESM imports resolve. (On CI the link is stripped and the
      // published package is auto-optimized from node_modules.)
      include: ['hotkeys-js', '@courthive/provider-config'],
    },
    // Vitest: only the in-source unit specs. The Playwright e2e suite lives in
    // `e2e/**/*.spec.ts` and must not be collected by vitest (those files
    // import `@playwright/test`, which throws under the vitest runner).
    test: {
      include: ['src/**/*.test.ts'],
    },
  } as any);
};

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default ({ mode }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const BASE_URL = (process.env.BASE_URL && `/${process.env.BASE_URL}/`) || '';

  return defineConfig({
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
    plugins: [svelte()],
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

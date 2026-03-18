import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig, loadEnv } from 'vite';

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
    plugins: [tsconfigPaths()],
    base: BASE_URL,
    optimizeDeps: {
      include: ['hotkeys-js'],
    },
  });
};

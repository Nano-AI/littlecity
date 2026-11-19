import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

// One config for the app, the gallery, the shot page, Vitest and the Node CLIs.
// Later agents should not need to edit this file: new pages are not expected,
// and everything else is discovered by file glob (docs/swarm/CONTRACTS.md).
export default defineConfig({
  root,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1' },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        gallery: fileURLToPath(new URL('./gallery/index.html', import.meta.url)),
      },
    },
  },
});

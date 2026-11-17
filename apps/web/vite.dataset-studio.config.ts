import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  envPrefix: 'DATASET_PUBLIC_',
  build: {
    outDir: fileURLToPath(new URL('../../.artifacts/dataset-studio/dist', import.meta.url)),
    emptyOutDir: false,
    rollupOptions: { input: fileURLToPath(new URL('./dataset-studio.html', import.meta.url)) },
  },
});

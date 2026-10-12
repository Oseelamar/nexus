import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // Layout studies for the Open Questions section (not linked from the site).
        questions: resolve(__dirname, 'questions.html'),
        // Layout studies for the Method section (not linked from the site).
        method: resolve(__dirname, 'method.html'),
      },
    },
  },
});

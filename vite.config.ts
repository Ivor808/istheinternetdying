import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    tanstackStart({
      srcDirectory: 'app',
      server: {
        entry: './ssr',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});

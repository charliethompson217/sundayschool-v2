import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/types\/(.+)$/, replacement: path.resolve(__dirname, 'types/$1') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});

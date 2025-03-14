import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'otdr-reader/[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'otdr-reader/[name].[ext]'
      }
    }
  }
});

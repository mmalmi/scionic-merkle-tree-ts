import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/browser',
    lib: {
      entry: resolve(__dirname, 'src/browser.ts'),
      name: 'ScionicMerkleTree',
      formats: ['es', 'umd'],
      fileName: (format) => `scionic-merkle-tree.${format}.js`,
    },
    rollupOptions: {
      external: ['fs', 'path', 'os'],
    },
    sourcemap: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/browser/**/*.test.ts'],
  },
});

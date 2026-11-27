import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Cargo locks and replaces native binaries while compiling on Windows.
      // Tauri watches its own Rust source files; Vite only needs the frontend.
      ignored: ['**/src-tauri/**', '**/production/**'],
    },
  },
  build: { target: 'esnext' },
});

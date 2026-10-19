import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        // The development server is loopback-only. Forward a same-origin
        // request to the loopback API without weakening its Origin policy.
        configure(proxy) {
          proxy.on('proxyReq', (request, incoming) => {
            if (incoming.headers.origin === 'http://127.0.0.1:5173') {
              request.setHeader('Origin', 'http://127.0.0.1:8787');
            }
          });
        },
      },
    },
  },
  build: { sourcemap: false },
});

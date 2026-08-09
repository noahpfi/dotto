import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// subpath deploy needs change
export default defineConfig({
  base: '/',
  plugins: [tailwindcss()],
  // mirrors /ingest rewrite in vercel.json -> first-party api_host works in dev
  server: {
    proxy: {
      '/ingest/static': {
        target: 'https://eu-assets.i.posthog.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest\/static/, '/static'),
      },
      '/ingest': {
        target: 'https://eu.i.posthog.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ''),
      },
    },
  },
});

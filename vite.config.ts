import { defineConfig, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import geoHandler from './api/geo.ts';
import { applyDarePreview } from './api/dare.ts';

// unset DEV_GEO_COUNTRY fails closed
// narrow decl keeps @types/node globals out of browser-only code
declare const process: { env: Record<string, string | undefined> };

function devGeo(): Plugin {
  return {
    name: 'dotto-dev-geo',
    configureServer(server) {
      server.middlewares.use('/api/geo', (_req, res) => {
        const country = process.env.DEV_GEO_COUNTRY ?? '';
        const headers = new Headers();
        if (country !== '') headers.set('x-vercel-ip-country', country);
        const response = geoHandler(new Request('http://localhost/api/geo', { headers }));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        void response.text().then((body) => res.end(body));
      });
    },
  };
}

// per-dare Open Graph tags in vite dev via api/dare.ts transform
function devDarePreview(): Plugin {
  return {
    name: 'dotto-dev-dare-preview',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // dev origin = public address eg tunnel -> crawler can fetch image
        const origin = process.env.DEV_PUBLIC_ORIGIN ?? 'http://localhost:5200';
        return applyDarePreview(html, new URL(ctx.originalUrl ?? '/', origin), origin);
      },
    },
  };
}

// subpath deploy needs change

export default defineConfig({
  base: '/',
  plugins: [tailwindcss(), devGeo(), devDarePreview()],
  // mirrors /ingest rewrite in vercel.json -> first-party api_host works in dev
  server: {
    // true would disable DNS-rebinding protection
    allowedHosts: ['.trycloudflare.com'],
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

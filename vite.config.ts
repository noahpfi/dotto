import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// subpath deploy needs change
export default defineConfig({
  base: '/',
  plugins: [tailwindcss()],
});

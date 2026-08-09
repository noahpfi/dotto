import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// base ./ -> build runs from any static host or subpath without rebuild
export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
});

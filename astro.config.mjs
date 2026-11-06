// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Required for canonical URLs, OG tags and the sitemap to be absolute.
  site: 'https://madebygio.dev',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [mdx(), sitemap()],

  build: {
    // Emit /work/foo/index.html so URLs have no trailing-slash ambiguity
    // on Cloudflare Pages.
    format: 'directory'
  }
});
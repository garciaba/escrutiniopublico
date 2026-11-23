import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';

// Run through the pnpm scripts, from the repository root (`astro … --root web`):
// the pages read data/derived/ and config/ relative to it.
export default defineConfig({
  site: 'https://escrutiniopublico.es',
  output: 'static',
  trailingSlash: 'never',
  // Never inline styles or scripts: the CSP in public/_headers only allows files of the site.
  build: { format: 'file', inlineStylesheets: 'never' },
  integrations: [preact()],
  devToolbar: { enabled: false },
  markdown: { syntaxHighlight: false },
  vite: {
    build: { assetsInlineLimit: 0 },
    server: { fs: { allow: ['..'] } },
  },
});

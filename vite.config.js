import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base. This is what lets one build work everywhere:
  // a domain root, a GitHub Pages project subfolder
  // (/happy-birthday-tree/), Netlify, Vercel, or a dist/ folder
  // opened straight off a USB stick. Absolute '/' broke the
  // Pages deploy before — see .github/workflows/deploy.yml.
  base: './',

  build: {
    // These are photographs; a gift is not the place to be stingy
    // about quality, and Vite would otherwise inline small assets
    // as base64 and bloat the JS.
    assetsInlineLimit: 0,
  },
})

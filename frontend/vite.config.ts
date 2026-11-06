import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // base relativa: funciona tanto en GitHub Pages (subruta /Proyecto_g/)
  // como en Vercel (raíz /). Requiere HashRouter, que ya usamos en App.tsx.
  base: './',

  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      // El manifiesto es public/manifest.json (enlazado en index.html, con los
      // íconos reales). Sin esto el plugin generaba un segundo manifiesto
      // «Proyecto G» con íconos inexistentes (RNF-15).
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Las rutas del backend NUNCA se responden con la app guardada.
        // Sin esto, al volver de Google (/api/v1/integrations/google/callback)
        // el service worker devolvía index.html; sus estilos relativos se
        // pedían a /api/v1/.../assets/*.css, el backend respondía JSON
        // («MIME type application/json») y la página quedaba en blanco.
        //
        // Tampoco los archivos (PDF de /material, imágenes, etc.): abrir uno en
        // el visor (iframe) o en una pestaña nueva es una navegación, y el
        // service worker respondía index.html en vez del archivo, así que la
        // vista previa quedaba en blanco o mostraba la app.
        navigateFallbackDenylist: [
          /^\/api\//, /^\/docs/, /^\/redoc/, /^\/openapi\.json/, /^\/health/,
          /\/material\//, /\/[^/]+\.[a-z0-9]{2,5}$/i,
        ],
      }
    })
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;

          if (/@react-three|three|@pixiv\//.test(id)) return 'three-vrm';
          if (/gsap|@gsap\//.test(id)) return 'gsap';
          if (/framer-motion/.test(id)) return 'framer-motion';
          if (/jspdf|html2canvas|html2pdf/.test(id)) return 'pdf';
          if (/lucide-react/.test(id)) return 'lucide';
          if (/daisyui|tailwindcss/.test(id)) return 'css';
          if (/react|react-dom/.test(id)) return 'react-vendor';
          if (/axios/.test(id)) return 'http';

          return 'vendor';
        },
      },
    },
  },
})
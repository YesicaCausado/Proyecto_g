import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // En desarrollo local, reenvía /api → backend en puerto 8000
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
    rollupOptions: {
      output: {
        // Separa las librerías pesadas en chunks propios para que el
        // navegador las cachee por separado y no vuelvan a descargarse
        // cuando cambia el código de la app.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;

          if (/@react-three|three|@pixiv\//.test(id)) return 'three-vrm';
          if (/gsap|@gsap\//.test(id))               return 'gsap';
          if (/framer-motion/.test(id))             return 'framer-motion';
          if (/jspdf|html2canvas|html2pdf/.test(id)) return 'pdf';
          if (/lucide-react/.test(id))              return 'lucide';
          if (/daisyui|tailwindcss/.test(id))       return 'css';
          if (/react|react-dom/.test(id))           return 'react-vendor';
          if (/axios/.test(id))                     return 'http';
          if (/lenis/.test(id))                     return 'scroll';
          return 'vendor';
        },
      },
    },
  },
})
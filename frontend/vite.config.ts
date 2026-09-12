import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Pre-bundle these so Vite doesn't try to analyze the UMD bundle internals
    include: ['cornerstone-core', 'cornerstone-wado-image-loader', 'dicom-parser'],
    exclude: [],
  },
  build: {
    commonjsOptions: {
      include: [/cornerstone/, /dicom-parser/, /node_modules/],
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Node.js backend (RDV, patients, auth...)
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        // لا نعيد توجيه /api/ai إلى Node.js
        bypass(req) {
          if (req.url?.startsWith('/api/ai') || req.url?.startsWith('/api/health')) {
            return false; // لا تعالج هنا
          }
        },
      },
      // FastAPI AI Service
      '/api/ai': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  define: {
    // متغيرات البيئة للـ frontend
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:5005'),
    'import.meta.env.VITE_AI_SERVICE_URL': JSON.stringify('http://localhost:8000'),
  },
})

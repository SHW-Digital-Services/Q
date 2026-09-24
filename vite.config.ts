import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // WebLLM is intentionally lazy-loaded for local AI; keep the warning budget
      // above that known chunk while feature screens are split by route/tab.
      chunkSizeWarningLimit: 6500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@mlc-ai/web-llm')) return 'ai-webllm';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) return 'pdf-export';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            return undefined;
          },
        },
      },
    },
  };
});

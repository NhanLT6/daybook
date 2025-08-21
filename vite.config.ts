import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import vuetify from 'vite-plugin-vuetify';

// import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vuetify({
      autoImport: { labs: true },
    }),
    // vueDevTools(),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
      sass: {
        api: 'modern-compiler',
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vue ecosystem
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          // UI library
          'vuetify': ['vuetify'],
          // Chart libraries
          'chart': ['chart.js', 'chartjs-plugin-datalabels', 'patternomaly'],
          // Utility libraries
          'utils': ['lodash', 'dayjs', 'nanoid', 'axios'],
          // Form libraries
          'forms': ['vee-validate', 'yup'],
          // File and data processing
          'data': ['papaparse', 'file-saver'],
          // Calendar and UI components
          'calendar': ['v-calendar', '@vueuse/core'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

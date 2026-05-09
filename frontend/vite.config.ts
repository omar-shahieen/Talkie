import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  server: {
    port: 3001,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@chakra-ui') || id.includes('@emotion')) {
            return 'chakra-ui';
          }

          if (id.includes('react-router-dom')) {
            return 'router';
          }

          if (id.includes('socket.io-client')) {
            return 'socket';
          }

          if (id.includes('@supabase')) {
            return 'supabase';
          }

          if (id.includes('framer-motion')) {
            return 'motion';
          }

          if (id.includes('@fontsource')) {
            return 'fonts';
          }

          return 'vendor';
        },
      },
    },
  },
});

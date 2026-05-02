import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 4173,
    // Railway's reverse proxy forwards requests with the public *.railway.app
    // hostname, which Vite's preview server rejects by default. Allow any host.
    allowedHosts: true,
  },
});

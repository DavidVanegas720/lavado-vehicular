import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const WEB_CONFIG = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID'].map((k) => `VITE_FIREBASE_${k}`);

export default defineConfig(({ mode }) => {
  // A deploy build (--mode prod) must never ship a page without its web config.
  if (mode === 'prod') {
    const env = loadEnv(mode, process.cwd(), 'VITE_FIREBASE_');
    const missing = WEB_CONFIG.filter((k) => !env[k]);
    if (missing.length) throw new Error(`Missing ${missing.join(', ')} (set them in .env.prod)`);
  }
  return {
    plugins: [vue(), tailwindcss()],
    server: { proxy: { '/api': 'http://127.0.0.1:5001/demo-lavadero/us-east1/api' } },
  };
});

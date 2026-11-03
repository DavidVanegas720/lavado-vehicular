import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import './style.css';
import { setMockNow } from './mocks/session.js';

createApp(App).use(createPinia()).use(router).mount('#app');
if (import.meta.env.DEV) window.setMockNow = setMockNow;

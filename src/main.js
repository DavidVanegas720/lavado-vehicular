import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import './style.css';

// pinia must be installed before the router: the router guard reads the session store.
createApp(App).use(createPinia()).use(router).mount('#app');

import { createRouter, createWebHistory } from 'vue-router';
import SignIn from '../views/SignIn.vue';
import AppShell from '../views/AppShell.vue';
import PlaceholderView from '../views/PlaceholderView.vue';
import NewWash from '../views/NewWash.vue';
import { NAV } from './nav.js';
import { canAccess, homeRouteFor } from '../domain/roles.js';
import { useSessionStore } from '../stores/session.js';

const VIEWS = { '/new-wash': NewWash };

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/sign-in', name: 'sign-in', component: SignIn },
    {
      path: '/',
      component: AppShell,
      children: NAV.map((item) => ({
        path: item.path.slice(1),
        component: VIEWS[item.path] ?? PlaceholderView,
        meta: { title: item.label, roles: item.roles },
      })),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// Requires pinia to be installed before the router (see main.js).
router.beforeEach((to) => {
  const session = useSessionStore();
  if (!session.active) return to.name === 'sign-in' ? true : { name: 'sign-in' };
  if (to.name === 'sign-in' || to.path === '/') return homeRouteFor(session.role);
  if (to.meta.roles && !canAccess(session.role, to.meta.roles)) return homeRouteFor(session.role);
  return true;
});

export default router;

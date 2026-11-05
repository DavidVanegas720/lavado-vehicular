import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '../stores/session.js'
import { NAV, homeOf } from './nav.js'
import AppShell from '../views/AppShell.vue'
import SignIn from '../views/SignIn.vue'
import NewWash from '../views/NewWash.vue'
import MyOrders from '../views/MyOrders.vue'
import CatalogAdmin from '../views/CatalogAdmin.vue'
import WashersAdmin from '../views/WashersAdmin.vue'
import OperatorsAdmin from '../views/OperatorsAdmin.vue'
import ShiftsAdmin from '../views/ShiftsAdmin.vue'
import ShiftClose from '../views/ShiftClose.vue'
import PlateHistory from '../views/PlateHistory.vue'
import WasherPay from '../views/WasherPay.vue'
import BusinessesView from '../views/BusinessesView.vue'
import SuspendedView from '../views/SuspendedView.vue'
import { getSession } from '../services/session.js'
import PlaceholderView from '../views/PlaceholderView.vue'
import { MOCK } from '../api/client.js'

const real = { '/new-wash': NewWash, '/my-orders': MyOrders, '/shift-close': ShiftClose, '/shifts': ShiftsAdmin, '/catalog': CatalogAdmin, '/washers': WashersAdmin, '/operators': OperatorsAdmin, '/plate-history': PlateHistory, '/washer-pay': WasherPay, '/businesses': BusinessesView }
// shortcut: superadmin screens stay on the mock until P11; use npm run dev:mock
const onApi = (path) => MOCK || NAV.operator.some((e) => e.path === path) || NAV.admin.some((e) => e.path === path)
const paths = [...new Set(Object.values(NAV).flat().map((e) => e.path))]

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/sign-in', component: SignIn },
    { path: '/suspended', component: SuspendedView },
    {
      path: '/',
      component: AppShell,
      children: [
        ...paths.map((path) => ({ path, component: onApi(path) ? (real[path] ?? PlaceholderView) : PlaceholderView })),
        { path: ':pathMatch(.*)*', component: PlaceholderView },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const store = useSessionStore()
  await store.ready
  const { user } = store
  if (!user) return to.path === '/sign-in' ? true : '/sign-in'
  // Read the service on every navigation (no cache) so unblocking restores access.
  if (to.path === '/suspended') return (await getSession())?.businessBlocked ? true : homeOf(user.role)
  if ((await getSession())?.businessBlocked) return to.path === '/sign-in' ? true : '/suspended'
  const home = homeOf(user.role)
  return NAV[user.role].some((e) => e.path === to.path) ? true : home
})

export default router

import {
  Building2,
  Calculator,
  ClipboardList,
  History,
  PlusCircle,
  Store,
  Users,
} from '@lucide/vue';
import { ROLES } from '../domain/roles.js';

// Paths are relative to the app shell. The router builds its children from this list.
export const NAV = [
  { path: '/businesses', label: 'Negocios', icon: Building2, roles: [ROLES.SUPERADMIN] },
  { path: '/cash-close', label: 'Cierre del día', icon: Calculator, roles: [ROLES.ADMIN] },
  { path: '/catalog', label: 'Catálogo', icon: Store, roles: [ROLES.ADMIN] },
  { path: '/washers', label: 'Lavadores', icon: Users, roles: [ROLES.ADMIN] },
  { path: '/plate-history', label: 'Historial por placa', icon: History, roles: [ROLES.ADMIN] },
  { path: '/new-wash', label: 'Nueva lavada', icon: PlusCircle, roles: [ROLES.OPERATOR] },
  { path: '/my-orders', label: 'Mis órdenes de hoy', icon: ClipboardList, roles: [ROLES.OPERATOR] },
];

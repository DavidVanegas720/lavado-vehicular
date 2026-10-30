# A1 — Skeleton

**Status:** done, verified in browser at 375, 768 and 1280 px with `prefers-reduced-motion: reduce`.
**Approval:** Claude, under David's standing approval (ponytail).

## Built

- Vue 3.5.44, Pinia 4.1.0, vue-router 5.4.0, Tailwind 4.3.3, `@lucide/vue` 1.57.0 (`lucide-vue-next` is deprecated). All pinned exact, all at least two weeks old.
- Router with role guards: `domain/roles.js` (`canAccess`, `homeRouteFor`), `router/index.js`, `router/nav.js` (one list drives the menu and the routes).
- Sign-in with the seeded demo users, mock session service, Pinia session store.
- App shell: header with business and role, menu filtered by role, sign out.
- Placeholder pages for each menu entry.
- Unit test for the role helpers (`node --test`).

## Verified

- Each role sees its own menu: superadmin (Negocios), admin (Cierre, Catálogo, Lavadores, Historial), operator (Nueva lavada, Mis órdenes).
- An operator who navigates to `/catalog` is sent to `/new-wash`.
- No horizontal scroll at 375, 768 and 1280 px.
- `npm test` passes (2 tests). `npm run build` passes.

## Not done here

- Seed data beyond users and businesses (categories, prices, washers, orders) comes in A2–A4.
- Mock state resets on page reload. This is the shortcut recorded in `00-plan.md`.
- The browser checks used a DOM snapshot for the menus and screenshots for layout. No automated browser test was added; that comes with the E2E setup if we decide we want it.

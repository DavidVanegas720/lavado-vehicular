# A0 — Plan

**Status:** approved by Claude under David's standing approval (ponytail). Revocable.
**Goal:** lock the model, the service interface and the backend choice before any app code.
**Correction (A1):** the first version used Spanish identifiers. The kickoff spec requires English identifiers, folders and file contents. Names below are the English ones. UI text stays in Spanish.

## Decisions

All domain and stack decisions are in `CLAUDE.md`. This file adds the structure.

## Layout

```
src/
  domain/          pure modules, no framework, unit tested
    roles.js         ROLES enum: superadmin, admin, operator
    plate.js         normalizePlate, validatePlate(plate, vehicleType)
    displacement.js  categoryForCc(cc, categories), non-overlapping ranges
    commission.js    calculateCommission(listPrice, commissionBp)
    money.js         formatCOP(pesos) via Intl, es-CO, no decimals
    businessDay.js  businessDay(date) → 'YYYY-MM-DD', week, month; America/Bogota
  services/        the only data access that views and stores may import
    session.js       signIn, signOut, currentUser
    catalog.js       listCategories, listWashTypes, listPrices, listWashers (CRUD in A3)
    orders.js        createOrder, listTodayOrders, cancelOrder, dailyClose (A2, A4)
    vehicles.js      plateHistory(plate), admin only (A5)
    businesses.js    listBusinesses, createBusiness, recordPayment, setStatus, expiryAlerts (A7)
  mocks/           in-memory implementation of services/*, with seed data
  stores/          Pinia; calls services only
  views/           Vue views
  router/          routes and role guards
tests/
  domain/          unit tests for domain/*
  contracts/       contract tests run against any implementation of services/*
```

## Service interface rules

- Every function receives the session from `session.js`; it never trusts a business id from the caller.
- Errors are thrown as `Error` with a `code`: `forbidden`, `business_blocked`, `validation`, `not_found`, `courtesy_reason_required`, `category_mismatch`.
- The mock enforces the same rules as the backend: role checks, admin-only history, blocked business, courtesy reason, cc inside the category range. A view must never be the only place a rule lives.
- Dates in and out are already operating days (`'YYYY-MM-DD'`); views do not compute them.
- Money is integer pesos everywhere in the interface.

## Mock behavior

- Data lives in memory, seeded at startup. Reloading resets it.
- `// shortcut: state lost on reload, replaced by real backend in B1`.
- No localStorage. It would hide the reset and tempt the views to read it.

## Contract tests (from A1)

Run against `services/*` through the mock now, and against the backend in B4.

1. An operator cannot call `vehicles.plateHistory`.
2. An operator cannot read another business's orders; reading own day's orders works.
3. A blocked business throws `business_blocked` for every call.
4. A courtesy without a reason throws `courtesy_reason_required`.
5. A cc outside the chosen category throws `category_mismatch`.
6. Changing a washer's commission does not change an existing order.

## Backend choice (for the record, built in B1)

Cloud Functions 2nd gen on Google Cloud, in the Firebase project on Blaze. See `CLAUDE.md`.

## Acceptance for A0

- Layout, service interface and contract list written here.
- Approved under standing approval.
- No app code written.

## Next

A1 — skeleton: Vue + Pinia + Tailwind + Lucide, router with role guards, layout, mock wiring, seed data. Done when `npm run dev` runs and each simulated role sees its own menu.

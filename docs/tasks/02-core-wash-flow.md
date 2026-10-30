# A2 — Core wash flow (the MVP screen)

## Goal

An operator registers a motorcycle wash: plate and cc → suggested category → wash type with price → washer → commission preview → save.

## Acceptance (from the kickoff spec)

- 150 cc, "Full" at $25.000, washer at 40% → `commissionAmount: 10000`.
- After the washer moves to 50%, a new order gets 50%; the earlier order still shows 40%.
- A courtesy needs a reason and still pays the washer the commission on the list price.

## Decisions taken for this task

- Category is suggested from cc; the operator confirms it (radio list). Backend re-checks the range (`category_mismatch`).
- Only motorcycles in A2. Car flow waits for A6.
- Payment: `cash` or `qr`, recorded only.
- Courtesy: `finalPrice = 0`, commission still on list price, reason required.
- Operator sees only own orders from today (option (a) from CLAUDE.md). Admin sees all of today's business orders. Listing is in `listTodayOrders`, needed here to prove the old order keeps 40%.
- `setWasherCommission` is the minimal part of A3 needed for the acceptance above. Admin only. Records a history entry (`commissionHistory`).
- Vehicle history (`vehicles/{plate}`) is **not** in A2. It belongs to A5, the only consumer.

## Layout

```
src/domain/
  plate.js          normalizePlate, validatePlate
  displacement.js   categoryForCc
  commission.js     calculateCommission (integer, half up)
  money.js          formatCOP
  businessDay.js    businessDay (America/Bogota calendar day)
  payment.js        PAYMENT_METHODS
src/mocks/
  errors.js         coded(code, message)
  catalog.js        businessCatalog (the only business filter for the catalog), list*, setWasherCommission
  orders.js         createOrder, listTodayOrders
src/services/
  catalog.js        re-exports mocks/catalog.js
  orders.js         re-exports mocks/orders.js
src/stores/washes.js  catalog load + save, used by the view
src/views/NewWash.vue
tests/domain/rules.test.js
tests/contracts/orders.test.js
```

## Contract tests (A2 scope)

Contracts 4, 5 and 6 from `00-plan.md`, plus snapshot values, role checks, blocked business and selection validation (added in 02a). Contract 2 (operator visibility) is covered in 02a. Contract 1 (plate history) comes with A5.

## Status

Done in A2. Corrected in 02a (`docs/tasks/02a-correccion-a0-a2.md`): blocked business, session copies, missing selections, load errors, isolation tests, `businessDay` rename, `@ts-check` and JSDoc in domain modules, dead export removed, `commissionHistory` hidden from operators.

## Verified

- Unit and contract tests: 18 pass (`npm test`). Build passes.
- Browser (A2, before correction): operator "Carlos Gómez": 150 cc suggests "De 126 a 200 cc"; Full shows $ 25.000; Pedro (40%) gets $ 10.000 in the preview and in the saved order.
- Browser (A2, before correction): courtesy without reason rejected; with reason saved at $ 0, commission on list price.
- Browser re-check after 02a (2026-10-30), 375, 768, 1280 px, reduced motion: empty form shows the field list; Pedro $ 25.000 / $ 10.000; courtesy without reason rejected; with reason saved at $ 0 and $ 12.500 for Jorge; no horizontal scroll; no console errors.

## Not done here

- The vehicle history update (`vehicles/{plate}`) is A5.
- The "Mis órdenes de hoy" screen is still a placeholder. The service `listTodayOrders` exists and is tested.
- Mock state resets on reload (shortcut from A0).
- The "change washer commission" screen is A3.

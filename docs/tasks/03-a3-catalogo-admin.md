# A3 — Admin catalog management

**Status:** plan by Opus, approved under the delegation in `CLAUDE.md`. Not started.
**Goal:** the admin (owner) manages the motorcycle catalog: displacement categories, wash types, the price matrix and washers with their commission. Nothing is deleted; items are deactivated.
**Read first:** `CLAUDE.md` (domain table: "Catalog changes", "Commission rate changes"), `02b-ratification.md` (rows 30, 37), `src/mocks/catalog.js`, `src/mocks/orders.js`.

## Acceptance

From `lavadero-prompt.md` §5, A3: *a price or percentage change affects only new orders.* Concretely:

1. 150 cc, Full, Pedro at 40% → order A: listPrice 25.000, commission 10.000. Admin sets the 126–200 cc × Full price to 30.000 and Pedro to 50%. Order B: listPrice 30.000, commission 15.000. Order A still reads 25.000 / 10.000 / 4000 bp. Proven by a contract test **and** in the browser.
2. A category whose cc range overlaps an active category is rejected (`category_overlap`), on create, on edit and on reactivate.
3. A deactivated category, wash type or washer disappears from the operator's lists and `createOrder` rejects it (`not_found`); the admin still sees it and can reactivate it.
4. Only an admin of the same business can read the admin catalog or change anything (`forbidden`, `not_found` across businesses, `business_blocked`).
5. No horizontal scroll and no console errors at 375, 768 and 1280 px, with `prefers-reduced-motion: reduce`.

## Decisions (Opus)

| # | Decision | Why |
|---|----------|-----|
| 1 | No delete function at all, for any catalog item. | "Nothing is deleted"; orders keep their snapshots anyway. |
| 2 | Overlap is checked only against **active** motorcycle categories of the same business, excluding the category being edited. Ranges touch, not overlap: 1–125 and 126–200 are fine. | Inactive categories never match a cc. |
| 3 | Gaps between ranges are allowed. | The spec already handles "no category matches". |
| 4 | cc range: integers, `1 ≤ ccMin ≤ ccMax ≤ 3000`. Names: trimmed, 1–60 chars. Duplicate names allowed. | Sanity bounds only; duplicate checks are extra. |
| 5 | Price: integer pesos, `1 ≤ amount ≤ 10.000.000`. $0 is rejected; free washes are courtesies. | Keeps the courtesy as the only zero-price path, with its reason. |
| 6 | A missing price means the pair is not offered. `NewWash` disables a wash type with no price for the chosen category. | Today the operator gets "Recargá la página", which is wrong. |
| 7 | Prices have no active flag and no history. Old prices live in order snapshots. | Spec does not ask for price history. |
| 8 | Commission changes, from either `saveWasher` or `setWasherCommission`, push one `commissionHistory` entry (rate, effectiveFrom, changedBy). Creating a washer pushes the first entry. | One audit path; matches the existing function. |
| 9 | Admin money input is text with `inputmode="numeric"`, parsed by `parsePesos` (strips `$`, spaces and `.`; digits only). Percentage input is text with `inputmode="decimal"`, parsed by `percentToBp` ("40", "40,5", "40.5" → 4000, 4050, 4050; at most 2 decimals; ≤ 100). | `<input type="number">` reads "25.000" as 25: a real money bug. No floats in parsing. |
| 10 | The mock's business filter and active filter are split: `businessCatalog(businessId)` returns all own items; `activeCatalog(businessId)` filters `active` over it. Operator lists and `createOrder` use `activeCatalog`. | 02b row 30. The business filter stays in one place. |
| 11 | After each admin write the store reloads the whole admin catalog. | One code path; a few items per business. |
| 12 | The price matrix is shown as one card per active category with a row per active wash type, not a table. | A table scrolls sideways at 375 px. |
| 13 | Pull forward the operator's "Mis órdenes de hoy" list (read-only, existing `listTodayOrders`). The NewWash success text adds the charged amount. | Acceptance 1 needs the old order visible in the browser (02a decision 18). The screen is already in the menu as a placeholder. |
| 14 | New items go last (`sortOrder` = max + 1). Wash types keep no `vehicleType` until A6. | No reordering UI. |

## Service functions (`src/mocks/catalog.js`, re-exported by `src/services/catalog.js`)

All call `requireSession([ROLES.ADMIN])` first, look items up through `businessCatalog(session.business.id)`, and return `structuredClone` copies. Error codes: `forbidden`, `business_blocked`, `validation`, `not_found`, and the new `category_overlap`.

| Function | Does | Errors |
|----------|------|--------|
| `listAdminCatalog()` | `{ categories, washTypes, prices, washers }`, all own items incl. inactive; washers without `commissionHistory`. | forbidden, business_blocked |
| `saveCategory({ id?, name, ccMin, ccMax })` | Create (`vehicleType: 'motorcycle'`, `active: true`) or update name and range. Returns the item. | validation, not_found, category_overlap |
| `setCategoryActive(id, active)` | Deactivate or reactivate; reactivating re-checks overlap. | validation, not_found, category_overlap |
| `saveWashType({ id?, name })` | Create or rename. | validation, not_found |
| `setWashTypeActive(id, active)` | | validation, not_found |
| `setPrice(categoryId, washTypeId, amount)` | Upsert the pair's price. Both ids must be own items (active or not). | validation, not_found |
| `saveWasher({ id?, name, commissionBp })` | Create, or update name and rate; a rate change pushes history (decision 8). | validation, not_found |
| `setWasherActive(id, active)` | | validation, not_found |
| `setWasherCommission(id, bp)` | Exists. Moves its history push into the shared helper. | unchanged |

`active` must be a boolean, else `validation`. Pure rules go to `src/domain/` so B4 reuses them:

- `displacement.js`: `findOverlap({ ccMin, ccMax }, categories)` → the first category with `a.ccMin ≤ b.ccMax && b.ccMin ≤ a.ccMax`, or null. The caller removes the edited category and inactive ones.
- `money.js`: `parsePesos(text)` → integer or null.
- `commission.js`: `percentToBp(text)` → integer bp or null; `formatPercent(bp)` → "40,5 %" via `Intl` (display only).

## Contract tests (`tests/contracts/catalog.test.js`, new)

Each test restores what it changes with `t.after` (deactivate what it created, reset prices and rates). New categories use ranges above 1000 to avoid the seed.

1. An operator gets `forbidden` from `listAdminCatalog` and every write.
2. Price and rate change only new orders: acceptance 1, read back through `listTodayOrders` as admin.
3. Overlap: create 100–150 → `category_overlap`; create 1001–1100 ok; edit it to 1001–1100 again ok (excludes itself); 1101–1200 ok (touching).
4. Reactivate overlap: deactivate a 1001–1100 category, create 1050–1150, reactivate the first → `category_overlap`.
5. Deactivated category, wash type and washer: missing from `listCategories` / `listWashTypes` / `listWashers` as operator; `createOrder` → `not_found`; present in `listAdminCatalog`; reactivated → orderable again.
6. Validation: price 0, -1, 25000.5, "25000" → `validation`; ccMin > ccMax, 0 or non-integer → `validation`; empty or 61-char name → `validation`; bp 10001 or 40.5 → `validation`; `active: 'no'` → `validation`.
7. Tenant isolation: admin of `biz-mixto` gets only own items (none today) and `not_found` on `setPrice('cat-200','wt-full',…)`, `saveCategory({ id: 'cat-200', … })`, `setWasherActive('w-pedro', false)`.
8. Blocked business: `listAdminCatalog` and `setPrice` → `business_blocked` (same seed shortcut as the orders test).
9. `saveWasher` with a new rate pushes one history entry; same rate pushes none. (Read the seed washer directly: history is not returned.)

Unit tests in `tests/domain/rules.test.js`: `findOverlap` (overlap, touching, empty list), `parsePesos` ("25.000", "$ 25.000", "25000" → 25000; "25,5", "", "abc", "-1" → null), `percentToBp` ("40", "40,5", "40.55", "100" → 4000, 4050, 4055, 10000; "100,01", "40,555", "-1", "" → null).

## Files

- `src/domain/displacement.js`, `money.js`, `commission.js` — new pure functions.
- `src/mocks/catalog.js` — filter split, new functions, shared history helper.
- `src/mocks/orders.js` — use `activeCatalog`.
- `src/mocks/seed.js` — `shortcut:` comment for in-memory state.
- `src/services/catalog.js` — re-export the new functions.
- `src/stores/catalogAdmin.js` — new: state + one action per service call, each followed by `load()`.
- `src/views/CatalogAdmin.vue` (`/catalog`), `src/views/WashersAdmin.vue` (`/washers`), `src/views/MyOrders.vue` (`/my-orders`) — new.
- `src/views/NewWash.vue` — disable wash types with no price; success text shows the charge.
- `src/router/index.js` — add the three views to `VIEWS`.
- `tests/contracts/catalog.test.js` (new), `tests/domain/rules.test.js`.

## Steps

Each step ends with `npm test` green. Model in brackets.

1. **[Sonnet]** Domain: `findOverlap`, `parsePesos`, `percentToBp`, `formatPercent`, JSDoc + `@ts-check`, unit tests. Add to `src/mocks/seed.js`: `// shortcut: mock state lives in memory and resets on reload; replaced by the real backend in B3–B4`.
2. **[Sonnet]** `mocks/catalog.js`: split `businessCatalog` / `activeCatalog` (operator lists and `orders.js` switch to `activeCatalog`); add every function in the table; shared commission-history helper; re-export in `services/catalog.js`. Contract tests 1–9.
3. **[Haiku]** `stores/catalogAdmin.js` and `VIEWS` entries in `router/index.js`. Follow `stores/washes.js` exactly.
4. **[Sonnet]** `CatalogAdmin.vue`: three sections (Categorías, Tipos de lavado, Precios). Categories: list with name, "126–200 cc", Activa/Inactiva, edit and Desactivar/Activar buttons; one form for new/edit. Wash types: same, name only. Prices: decision 12; each row shows the current price with `formatCOP`, a text input and Guardar; "Sin precio" when missing. Errors in Spanish in a `role="alert"`, success in an always-rendered `role="status"`. Messages: `category_overlap`: "Ese rango de cilindraje se cruza con otra categoría activa."; `validation`: name the field.
5. **[Sonnet]** `WashersAdmin.vue`: list with name, `formatPercent`, state; form for new/edit with name and percentage (`percentToBp`); Desactivar/Activar. Hint text: "El cambio aplica solo a lavadas nuevas."
6. **[Sonnet]** `NewWash.vue`: a wash type radio is `disabled` (and its label says "No disponible") when `priceOf(categoryId, id)` is null and a category is chosen; clear `washTypeId` if the chosen category has no price for it. Success text: "Lavada guardada: placa X, cobro $ …, comisión $ …".
7. **[Haiku]** `MyOrders.vue`: loads `listTodayOrders` on mount; list (not a table) with plate, wash type, `formatCOP(finalPrice)`, washer, `formatCOP(commissionAmount)`, "Cortesía: motivo" when it applies; empty state "Todavía no registraste lavadas hoy."; load error in `role="alert"`.
8. **[Sonnet]** Final check: `npm test`, `npm run build`, browser checks below. Write the status and verified lines in this file.

## Browser checks (375, 768, 1280 px, then 375 px with `prefers-reduced-motion: reduce`)

Switch users with "Salir", never by reloading (state is in memory).

1. Carlos (operator): 150 cc, Full, Pedro → saved with cobro $ 25.000, comisión $ 10.000.
2. Ana (admin) → Catálogo: set 126–200 × Full to "30.000" → shows $ 30.000. Lavadores: Pedro to "50" → shows 50 %.
3. Carlos: same wash → cobro $ 30.000, comisión $ 15.000. Mis órdenes de hoy: the first order still shows $ 25.000 / $ 10.000.
4. Ana: new category "Prueba" 100–150 → overlap message; 1001–1100 → saved. Deactivate "Más de 200 cc" and Jorge.
5. Carlos: 250 cc → "Ninguna categoría cubre ese cilindraje"; Jorge not in the list; 1050 cc → "Prueba" suggested, its wash types say "No disponible".
6. Ana: reactivate both; Carlos can use them again.
7. Every width: no horizontal scroll, tap targets usable, focus ring visible, no console errors.

## Not in A3 (named, skipped)

Delete, reordering, price history, duplicate-name checks, admin view of commission history, car categories (A6), daily totals and admin order list (A4), suspended screen (A7). Overlap must run inside a transaction in B4 (two admins saving at once).

## Questions for David

1. Should a change of price or of a washer's percentage require a note (e.g. "acuerdo con Pedro")? Default if not answered: no note; who and when are recorded for commission changes only.
2. Is a "not offered" pair (decision 6) real for Medallo Bikes, e.g. no "Full" for some cc range? Default: yes, a missing price hides the option.

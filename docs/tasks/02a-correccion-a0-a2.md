# A2a — Correction of A0, A1 and A2

**Status:** plan by Opus, pending approval under David's standing approval (ponytail).
**Goal:** close the gaps between what A0–A2 claim and what the code does, without adding scope.
**Sources checked:** `lavadero-prompt.md`, `CLAUDE.md` (on disk), `docs/tasks/00–02`, every file in `src/` and `tests/`. `npm test`: 14 pass on Node 24.20.0.

## Findings

Severity: **B** blocker, **S** should fix, **N** nice to have.

1. **B — Blocked business is not enforced.** `src/mocks/session.js:27-29` (`requireSession`) checks role only; nothing in `src/mocks/` reads `business.status`. `CLAUDE.md:30` says contract tests enforce blocked business *from A1*; `00-plan.md:41,57` lists `business_blocked` as a mock rule. `02-core-wash-flow.md:61` deferred it to A7 without recording why. Every service written in A3–A6 would be built without it.
2. **B — The project is not a Git repository.** `ls -a` shows no `.git`. The correction cannot be reviewed as a diff against A2, and A0–A2 have no baseline.
3. **S — The session leaks by reference.** `src/mocks/session.js:14-15` returns `current` itself; `src/stores/session.js:11` keeps it. A view that writes `session.user.role` changes what `requireSession` trusts. Same for `listDemoUsers` (`session.js:7-9`) returning the seed array. Note: `current.business` is a *reference* to the seed object, so a status change on the seed does reach `requireSession`; only the UI copy goes stale, which is also true of real claims (B6 handles refresh).
4. **S — Missing selection shows a wrong message.** Submitting without category, wash type or washer reaches `src/mocks/orders.js:23-32` with `''` ids and throws `not_found`; `src/views/NewWash.vue:14` then tells the operator to reload the page. This is the most common operator mistake.
5. **S — Catalog load has no error handling.** `src/views/NewWash.vue:34-37`: if `store.load()` throws (e.g. `business_blocked` after finding 1), the view stays on "Cargando catálogo…" forever with an unhandled rejection.
6. **S — Tenant isolation and operator visibility are untested.** `CLAUDE.md:30` requires it from A1. `listTodayOrders` (`orders.js:72-83`) filters by business and by `createdBy`, but no test proves either. Contract 2 of `00-plan.md:56` is testable now with the existing seed (admin of `biz-mixto`, operator vs admin of `biz-moto`).
7. **S — Tests depend on order inside one file.** `tests/contracts/orders.test.js:58-70` sets Pedro to 50% and never restores it; any test added after it that expects 40% fails. Across files there is no dependency: Node 24 runs each test file in its own process, so each re-imports a fresh seed.
8. **S — No JSDoc and no `// @ts-check` in money and rules modules.** Decided in `CLAUDE.md:21`. None of `src/domain/*.js` has either.
9. **S — Day function has the wrong name.** `CLAUDE.md:48` decides one function `businessDay()`; the code has `operatingDay()` (`src/domain/operatingDay.js:9`, used in `orders.js:5,65,74`, `tests/domain/rules.test.js:7,41`). The order field is already `businessDate`. A grep for the decided name finds nothing.
10. **S — Vehicle type is not checked on the order.** `orders.js:23-25` accepts any category of the business; a car category has no `ccMin`/`ccMax`, so `cc < undefined` is false and the range check passes, and the order is stamped `motorcycle` (`orders.js:44`). No car categories exist in the seed today.
11. **S — `vehicles/{plate}`, `isoWeek` and `month` are not written.** Spec `lavadero-prompt.md:15,57-59,67` and `CLAUDE.md:45,48`. `orders.js:65` writes only `businessDate`; the day module has no week or month (`00-plan.md:21` promises them).
12. **N — Owner's share is not stored.** Spec `lavadero-prompt.md:64` says store it; `CLAUDE.md:43` (snapshot list) leaves it out. Its value for a courtesy is undefined (see question 1).
13. **N — Operators receive commission audit data.** `src/mocks/catalog.js:34-37` returns each washer with `commissionHistory` (including `changedBy` uids). In the real model it is a subcollection (`CLAUDE.md:39`) that operators never get. The mock shows more than the backend will.
14. **N — Success message may not be announced.** `NewWash.vue:185` inserts the `role="status"` element with `v-if`; screen readers often miss live regions created at the same time as their text.
15. **N — Phone UX details.** Radio and checkbox tap targets are 20 px (`NewWash.vue:128,139,168,175`); the rate shows as `40.5` instead of `40,5` (`NewWash.vue:161`); copy uses voseo ("Revisá", "Elegí"), which is normal in Medellín but not confirmed.
16. **N — Dead export.** `currentSession` (`src/mocks/session.js:22-24`, `src/services/session.js:2`) has no caller.
17. **N — Stale names and docs.** Seed uses `vehicleTypes` (`seed.js:3-4`) where the model says `enabledVehicleTypes`; `CLAUDE.md:20` still says `lucide-vue-next` (A1 used `@lucide/vue`); `02-core-wash-flow.md:1-18` has Status and Verified above Goal, and line 61 contradicts `CLAUDE.md:30`.
18. **N — Commission change is proven only by a contract test** (`02-core-wash-flow.md:11`). The test calls the same service the A3 screen will call.
19. **N — Claims checked and found false.** (a) "Task docs 01 and 02 are in Spanish": `00`, `01` and `02` are in English; Spanish appears only as quoted UI labels. (b) "The view does service logic": `NewWash.vue` imports pure domain modules for the preview only; the spec (`lavadero-prompt.md:97`) asks for exactly that reuse, and the service recomputes everything.
20. **N — Seed is incomplete for later phases.** No orders, courtesies or payments; `biz-mixto` has no catalog and no operator (`lavadero-prompt.md:99`).

## Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Fix now | One condition in the shared choke point protects every later service. The suspended screen stays in A7. |
| 2 | Fix now (David) | Needed before step 1 so the correction is a reviewable diff. |
| 3 | Fix now | Two `structuredClone` calls. Trust boundary. |
| 4 | Fix now | Server returns `validation` for empty ids; view text covers all fields. |
| 5 | Fix now | try/catch and an alert; no retry logic. |
| 6 | Fix now | One test, no seed change. |
| 7 | Fix now | Restore Pedro with `t.after`. |
| 8 | Fix now | Decided rule; mechanical. |
| 9 | Fix now | Rename to the decided name before A4/A5 import it. |
| 10 | Defer to A6 | No car data exists yet; A6 rewrites this path. Add to A6 acceptance: "a car category id in a motorcycle order is rejected". |
| 11 | Defer to A5 | A5 is the only consumer. B3 must write order and vehicle in one transaction (`CLAUDE.md:45`). |
| 12 | Defer to A4 | A4 is the first reader of totals; needs question 1. |
| 13 | Fix now | One `map` that drops `commissionHistory` for the list. |
| 14 | Fix now | Accessibility is not cut. Keep the region rendered, toggle its text. |
| 15 | Defer to A8 | UX review with David is A8's job. |
| 16 | Fix now | Delete the export. |
| 17 | Fix now | Rename has no readers yet; docs are the resume point for the next chat. |
| 18 | Accept | Browser proof becomes part of A3 acceptance, which already says "a percentage change affects only new orders". |
| 19 | Reject | Nothing to change. |
| 20 | Defer | Orders and courtesies to A4, `biz-mixto` catalog and operator to A6, payments to A7. |

## Correction plan

Each step ends with `npm test` green. Model in brackets.

0. **[David]** `git init`, commit the current tree as the A2 baseline. Verify: `git status` clean.
1. **[Sonnet]** In `requireSession`, after the role check: if `current.business?.status === 'blocked'` throw `coded('business_blocked')`. Add `business_blocked: 'La cuenta está suspendida. Contactá a soporte.'` to `MESSAGES` in `NewWash.vue`. Test in `tests/contracts/orders.test.js`: *"a blocked business is rejected on every call"* — sets `biz-moto` to blocked through the seed (mark `// shortcut: blocks through the seed until businesses.setStatus exists in A7`), expects `business_blocked` from `createOrder`, `listTodayOrders` and `listWashers`, restores in `t.after`.
2. **[Sonnet]** `signIn` returns `structuredClone(current)`; `listDemoUsers` returns `structuredClone(users)`. `current` keeps its reference to the seed business. Test: *"changing the returned session does not grant permissions"* — operator signs in, sets `role = 'admin'` on the returned object, `setWasherCommission` still throws `forbidden`.
3. **[Sonnet]** In `createOrder`, before the lookups: if any of `categoryId`, `washTypeId`, `washerId` is empty, throw `coded('validation', 'missing selection')`. Change `MESSAGES.validation` to "Revisá los datos: placa, cilindraje, categoría, tipo de lavado y lavador." Test: *"missing selections are a validation error"*. Browser (375 px): plate + cc only, submit → the new message, not "Recargá la página".
4. **[Sonnet]** `NewWash.vue` `onMounted`: wrap `store.load()` in try/catch/finally; on error set `error` from `MESSAGES` and hide the form. Verify: diff review (only reachable after step 1 with a blocked business).
5. **[Sonnet]** Test *"orders are isolated by business and by operator"*: operator and admin of `biz-moto` each create one order; the operator's `listTodayOrders` has only theirs; the admin's has both; admin of `biz-mixto` gets an empty list and `not_found` on `createOrder(base)`. In the commission test add `t.after(() => setWasherCommission('w-pedro', 4000))` (signed in as admin).
6. **[Haiku]** `listWashers` returns washers without `commissionHistory`. Verify: `npm test`.
7. **[Haiku]** Rename `operatingDay` to `businessDay`, file `src/domain/operatingDay.js` to `src/domain/businessDay.js`; update `orders.js`, `tests/domain/rules.test.js`, `00-plan.md:21`, `02-core-wash-flow.md:44`. Verify: `grep -rn operatingDay src tests docs` returns nothing.
8. **[Haiku]** Add `// @ts-check` and JSDoc (`@param`, `@returns`) to every module in `src/domain/`. No logic change. Verify: `npm test`, `npm run build`.
9. **[Haiku]** Mechanical cleanup: render the success `role="status"` element always and put the text inside the `v-if`; delete `currentSession` from `mocks/session.js` and `services/session.js`; rename seed `vehicleTypes` → `enabledVehicleTypes`; `CLAUDE.md:20` → `@lucide/vue`; reorder `02-core-wash-flow.md` (Goal, Acceptance, Decisions, Layout, Status, Verified, Not done) and replace line 61 with "Contracts 2, 3 in 02a; contract 1 with A5". Add to the A6 doc, when written, the acceptance line from decision 10. Verify: `grep -rn currentSession src` empty; browser save shows the message.
10. **[Sonnet]** Final check. `npm test`, `npm run build`. Browser at 375, 768, 1280 px and with `prefers-reduced-motion: reduce`: operator Carlos, 150 cc, Full, Pedro → $ 25.000 and $ 10.000; courtesy without reason rejected; courtesy with reason saves $ 0 and pays commission on the list price; no horizontal scroll; no console errors. Record the result as a status line in this file and in `02-core-wash-flow.md`.

## Acceptance

- A Git baseline exists and the correction is one reviewable diff on top of it.
- `requireSession` rejects every call from a blocked business with `business_blocked`, proven by a test.
- Values returned by `signIn` and `listDemoUsers` are copies; mutating them changes no permission (test).
- Tenant isolation and operator-own-orders are proven by a test; no test depends on the order of another.
- Empty selections give a `validation` error and a Spanish message that names the fields.
- A failed catalog load shows an error instead of an endless loading state.
- Operators do not receive `commissionHistory`.
- The day function is `businessDay()` everywhere; domain modules have `// @ts-check` and JSDoc.
- The A2 browser example still passes at the three widths with reduced motion.
- No new dependency, no new screen, no new service function.

## Open questions for David

1. **Owner's share on the order (needed by A4).** The spec says store it; `CLAUDE.md` left it out of the snapshot. If stored, which definition: `finalPrice − commissionAmount` (the cash the owner actually keeps; negative for a courtesy, e.g. −$ 10.000) or `listPrice − commissionAmount` (what the wash was worth to the owner)? Recommendation: do not store it; A4 computes `finalPrice − commissionAmount` from the frozen fields, which shows the courtesy cost honestly.

## Not in this plan

Suspended screen (A7), car gating (A6), vehicle history and week/month fields (A5), seed orders (A4), UX review (A8).

## Status line (step 10)

Corrections 1 to 9 applied. Final check passed: 18 tests, build, browser at 375, 768, 1280 px with reduced motion, no horizontal scroll, no console errors. Git baseline (step 0) still pending on David.

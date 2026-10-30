# A2b — Ratification of decisions not taken by Opus

**Status:** decided by Opus, approved under the delegation in `CLAUDE.md`. 2026-10-29.
**Why:** the working rules say Opus makes every decision. These were taken earlier by other chats or by Sonnet/Haiku while coding. Each gets a verdict.
**Sources checked:** `lavadero-prompt.md`, `CLAUDE.md` on disk, `docs/tasks/00–02a`, all of `src/` and `tests/`. `npm test` green on Node 24.20.0.

Totals: **34 keep, 4 change, 0 reject.** The changes are recorded in `CLAUDE.md` (domain rows) or scheduled in `03-a3-catalogo-admin.md` (code).

## Domain table (`CLAUDE.md`)

| # | Decision | Verdict | Reason |
|---|----------|---------|--------|
| 1 | Commission rounding: `floor((p*bp+5000)/10000)`, half up | keep | Same as the spec's `Math.round` for non-negative integers, with no float step. |
| 2 | No edits; cancel = `status: 'cancelled'` + who/when | keep | Matches "nothing is deleted". Only the model: no cancel flow is built until David answers spec Q4 (spec §5 puts it under "Later"). |
| 3 | Courtesy: `finalPrice 0`, reason required, commission on list price | keep | Decided by David in the spec. |
| 4 | Operator visibility option (a) | keep | No client read on `orders` means no rule can leak plate history; the mock already works this way. |
| 5 | One business per user | keep | One `businessId` claim; going multi-business later only changes the claim shape. |
| 6 | Calendar day, Monday week, Bogotá | keep | Lavaderos work daytime; ISO week. One function (`businessDay`) to change if shifts ever cross midnight. |
| 7 | Plate formats; special plates rejected in MVP | keep | Reversible; an override needs UI and rules nobody asked for yet. |
| 8 | Block: `status` on business doc, backend check, rules `get()`, revoke refresh tokens | change | Drop the token revocation: backend and rules already check `status` per request, and revocation forces every user to sign in again after unblocking. |
| 9 | Billing: 0-day grace, 5-day alert window configurable | change | Blocking is manual, so a grace period has no code. "Overdue" = `paidUntil < today`; the 5-day window stays. |
| 10 | Payment methods `cash`, `qr` | keep | Spec assumption; recorded only. |
| 11 | Backend: Cloud Functions 2nd gen on Blaze | keep | Same project, Admin SDK, no server to run; free invocation tier covers one business. Budget alert before deploy stays mandatory. |
| 12 | `commissionHistory` subcollection, audit only | keep | Spec proposes it; cheap, never used to compute. |
| 13 | Order snapshot list (no owner's share) | keep | Owner's share is computed from frozen fields; see the "Owner's share" row in `CLAUDE.md`. |

## Stack

| # | Decision | Verdict | Reason |
|---|----------|---------|--------|
| 14 | Vue 3 | keep | Hard constraint. |
| 15 | Pinia | keep | Hard constraint. |
| 16 | Tailwind 4 | keep | Current major, Vite plugin, no config file. |
| 17 | `@lucide/vue` instead of `lucide-vue-next` | keep | The spec says verify the official name; `lucide-vue-next` is deprecated. |
| 18 | npm instead of pnpm | keep | Ships with Node, lockfile exists, nothing to gain. |
| 19 | Plain JS + JSDoc + `// @ts-check` in domain | keep | Spec default. Note: `@ts-check` is editor-only (no `tsc` run); money safety rests on `Number.isInteger` guards and tests. A checker would be a new dependency (David). |
| 20 | `node:test` instead of Vitest | keep | Zero dependencies, and the rule is no new dependencies. |
| 21 | Firebase Hosting for the frontend | keep | Same project, free tier, no extra vendor. |

## A1 structure

| # | Decision | Verdict | Reason |
|---|----------|---------|--------|
| 22 | `nav.js` is the single source for routes and menu | keep | Menu and guards cannot drift apart. |
| 23 | Role guards in the router | keep | UX only; services enforce roles in `requireSession`. |
| 24 | Demo sign-in by user id, no password | keep | Mock only, marked `shortcut:`, replaced in B1. |
| 25 | Placeholder views | keep | A1's "done when" is each role sees its menu. |

## A2 choices

| # | Decision | Verdict | Reason |
|---|----------|---------|--------|
| 26 | `setWasherCommission`, `listTodayOrders` pulled forward | keep | Needed to prove the A2 acceptance (40% → 50%). |
| 27 | `vehicles/{plate}` deferred to A5 | keep | A5 is its only reader; counts come from `orders`. |
| 28 | Category suggested from cc, operator confirms | keep | Spec flow; backend re-checks the range. |
| 29 | `listWashers` without `commissionHistory` | keep | Mirrors the real subcollection that operators never get. |
| 30 | `businessCatalog` keyed by businessId, the only filter | change | It also filters `active`, so the A3 admin screens cannot see inactive items. Split: `businessCatalog` = business filter only; `activeCatalog` = active items over it (A3 step 2). |

## 02a choices (Sonnet/Haiku while coding)

| # | Decision | Verdict | Reason |
|---|----------|---------|--------|
| 31 | Separate `loadError` ref in `NewWash.vue` | keep | The load error hides the form; sharing `error` would also hide it on every submit error. |
| 32 | Isolation test asserts "contains mine, all are mine" | keep | Tests in one file share state; the property is the rule, an exact list would couple tests. |
| 33 | Live region always rendered, text in a `<template>` | keep | It is what 02a asked for. |
| 34 | `CcCategory` typedef, cast in `homeRouteFor` | keep | Smallest way to satisfy `@ts-check`. |
| 35 | Seed `enabledVehicleTypes` | keep | Spec field name. |
| 36 | `operatingDay` → `businessDay`, file renamed | keep | Decided name; `grep` finds one spelling. |

## Shortcuts and persistence

| # | Decision | Verdict | Reason |
|---|----------|---------|--------|
| 37 | `shortcut:` comments | change | The two present are correct, but the in-memory reset promised in `00-plan.md` has no comment in code. Add it to `src/mocks/seed.js` (A3 step 1). |
| 38 | Mock-only, in-memory state, resets on reload | keep | localStorage would hide the reset and tempt views to read it. Browser checks switch users with "Salir", never by reloading. |

## Not checked

- The Git baseline from 02a step 0 still does not exist (`git rev-parse` fails). Changes cannot be reviewed as a diff until David runs `git init`.

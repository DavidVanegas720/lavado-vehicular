# CLAUDE.md

Multi-tenant SaaS for car and motorcycle wash businesses (lavaderos) in Colombia.
Full kickoff spec: `lavadero-prompt.md`. This file holds the decisions taken so far and the working rules.
Code, identifiers, comments and file contents are in English. User-facing UI text is in Spanish (Colombia).

## Working rules

- **Models:** Opus analyzes, builds every plan (`docs/plan/NN-name.md`) and makes every decision: product, domain, design, scope, naming, rules and the order of work. It runs as an Opus subagent. Sonnet and Haiku only write code that follows an Opus plan; they do not decide. Haiku for mechanical, low-risk edits (boilerplate, fixtures, renames); Sonnet for logic, money, security and rules. Any decision a Sonnet or Haiku agent meets while coding goes back to Opus, not into the code.
- **Ponytail:** the ponytail skill applies to all work: planning, code, review and reports. Every agent prompt must start with: "Your first action is to invoke the ponytail skill with the Skill tool. Do not continue until you have done so." The main session checks the agent transcript for a real Skill call before it accepts any report. "Available" or "if possible" is not an allowed wording.
- **Restart rule:** work restarts from a new Opus plan when the process was not followed. Earlier plans and code are kept in git history and are not reused unless the new plan says so. The 2026-10-29 restart rewrites the code from zero (David): P1 deletes the old `src/`, `tests/`, `index.html` and `vite.config.js` and writes new files; no old code is copied.
- **Commits:** no `Co-Authored-By` line and no AI attribution in commit messages or PR descriptions. English, imperative subject line.
- **Git:** Claude does not commit or push unless David asks for it. Never rewrite history.
- **Process:** plan first (`docs/plan/NN-name.md`: goal, decisions, acceptance criteria, status), then implement. Every phase ends at a checkpoint.
- **Approvals:** David delegated checkpoint and plan approval ("aprueba siempre usando ponytail"). Opus approves its own plans under that delegation and records the approval in the task doc. The main session only coordinates, runs the checks and reports. David can revoke this at any time.
- **Scope:** smallest usable core flow first. No gold-plating. Flag any extra you notice yourself adding.
- **Dependencies:** none without asking David. Prefer `Intl` for dates and currency.

## Stack

- Vue 3 + Pinia + Tailwind CSS + Lucide icons (`@lucide/vue`, verified in A1).
- Plain JavaScript with JSDoc. `// @ts-check` in the money and rules modules.
- Firebase: Auth + Firestore + Hosting. Backend: Cloud Functions 2nd gen (Node) on Google Cloud, Firebase Admin SDK. Functions run in the same GCP project as Firebase.
- No ORMs, no query builders, no Firestore ODMs. Firebase SDKs directly behind plain repository/service modules.
- Views and Pinia stores never import Firebase or call `fetch` directly.

## Build order

- Phases P1–P12 in `docs/plan/00-master.md` §4, in that order; no pilot (David, 2026-10-29). P1–P7 frontend on the mock layer, P8–P12 backend.
- From P1: contract tests run against the mock and enforce tenant isolation, admin-only history and blocked business. They run against the real backend from P9.

## Domain decisions

| Topic | Decision |
|-------|----------|
| Money | Integer COP pesos. No floats, no decimals, no centavos. |
| Commission | `commissionAmount = Math.floor((listPrice * commissionBp + 5000) / 10000)` (half up, integer math). Base is always `listPrice`. |
| Commission rate changes | Owner (admin) only. Apply only to orders created afterwards. Old orders keep their snapshot. |
| Commission history | Subcollection `businesses/{bid}/washers/{id}/commissionHistory` (rate, effectiveFrom, changedBy). Audit only, never used to compute. |
| Courtesy | Full courtesies only, no partial discounts: `finalPrice` is `listPrice` or `0`. A courtesy has `isCourtesy = true` and `courtesyReason` required, 1–200 chars after trim. Backend rejects otherwise (David, 2026-10-29). |
| Operator order visibility | Option (a): operators have no client read on `orders`. The backend returns their own orders of the current shift plus their own `in_progress` orders of earlier shifts not yet closed, and the cash summary of a shift they close (no earned washer pay, no owner's share), and from P3 each active washer's balance owed in "Pago a lavador" (§2.5). Admins read through the repository. |
| Order lifecycle | `status`: `in_progress` (created when the vehicle arrives; prices and commission frozen) → `done` (operator taps "Lavada terminada": sets `doneAt`, `doneBy`, `paymentMethod`) or → `cancelled` (before the wash only). `done` is final: it cannot be cancelled or returned. That is the only way "wash done" is recorded (Opus, 2026-10-29). |
| Cancel | Before the wash only (from `in_progress`, creator operator or admin): reason required (`cancelReason`, 1–200 chars), plus `cancelledAt`, `cancelledBy`. The washer earns 0 for a cancelled order. A `done` or `cancelled` order → `invalid_state`. The frozen `commissionAmount` is never reversed (David, 2026-11-03; `docs/plan/07-sin-devoluciones.md`). |
| Refunds | **None, in any role.** No lavadero refunds money: no refund action, field, total or report line (David, 2026-11-03; restores the original "not built" rule; `docs/plan/07-sin-devoluciones.md`). |
| Shift totals | Per shift instance (`shiftKey`); same formulas over a week or month. Sales = `sum(finalPrice)` of `done` orders, per payment method. Washer pay = `sum(commissionAmount)` of `done`. Owner's share = sales − washer pay. `in_progress` orders are in no total, shown as "Sin terminar" (Opus, 2026-10-29). |
| Order edits | None, except the status transitions in "Order lifecycle" and "Cancel". Nothing is deleted; cancelled orders stay in history. |
| Order snapshot | Copy `categoryName`, `ccMin`, `ccMax`, `washTypeName`, `listPrice`, `washerName`, `commissionBp`, `commissionAmount`. |
| Category check | Client suggests the category from cc. Backend re-checks that the cc falls in the category's range; rejects otherwise (`validation`). Ranges never overlap, so the operator must keep the suggested category. |
| Transaction | Backend reads categories, prices and washer inside the same transaction that writes the order and updates `vehicles/{plate}`. Never reads prices from the client. |
| Hot documents | No counters on business or washer docs. Washer doc is not written per order. |
| Users | One business per user. Claim `businessId` plus role. |
| Roles | Closed enum `ROLES = ['superadmin', 'admin', 'operator']`; no new role, no per-user flag, no permission matrix. The "operational role" that opens and closes shifts is the operator. The admin creates, renames, deactivates and reactivates operators (P2) and cannot open, close or reopen shifts, act as an operator, or create admins. A deactivated operator gets `forbidden` (Opus, 2026-10-29). Full rule: `docs/plan/00-master.md` §2.4. |
| Shifts, day and week | A shift runs straight through midnight and closes at its own end hour; there is a shift close (David, correction, 2026-10-29). Business doc `shifts: [{ id, name, startHour, endHour }]`, integer Bogotá hours, tiling 24 h with no gap or overlap (`assertShifts`); hours agreed by David with the owner, edited by the superadmin (P6). `shiftOf(date, shifts)` is the one shift/day function for the whole app: the server stamps `shiftId`, `shiftName`, `shiftKey`, `businessDate` (date the shift instance started), Monday-start `isoWeek` and `month` on the order at creation; week and month derive from `businessDate`. The shift ends by the clock. **Operators, never the admin or superadmin, open, close and reopen shifts** (David, second correction, 2026-10-29): any active operator opens the current instance with the cash base (`openingCash`); no order is created until it is open (`shift_not_open`); any operator closes an open instance after its end, with no `in_progress` order, with the counted cash (`countedCash`, `expectedCash`, `difference` and a totals snapshot stored; the admin reads the difference, nobody approves it); any operator reopens a closed one with a reason (1–200 chars). Each action is a `shiftEvents` event; the latest one decides the state; nothing is overwritten. Orders of a closed shift are frozen (`shift_closed`). An unclosed shift stays open and never blocks the next one. The admin only reads instances, events and totals. Real hours pending David; seed uses a placeholder 24 h shift (Opus, 2026-10-29). Full rule: `docs/plan/00-master.md` §2.2. |
| Shift cash | Operator enters the opening cash (base) at open and the counted cash at close; nothing more for now (David, 2026-10-29). `expectedCash = openingCash + cash sales of the instance's done orders − till washer payments of the instance` (no refunds, `docs/plan/07-sin-devoluciones.md`). |
| Washer pay schedule | Per washer `payFrequency`: `daily`, `weekly` (Mon–Sun), `biweekly` (day 1–15 and 16–end of month, the Colombian payroll "quincena"; fixed halves need no start date per washer; decided by Opus, David may change it) or `monthly`; default `biweekly` (David). Admin only sets it; a change overwrites the field, appends to `payFrequencyHistory` (audit) and never touches orders or payments. Periods come from the order's `businessDate` via `payPeriodOf(businessDate, payFrequency)` in `src/domain/washerPay.js`, never from a timestamp. Full rule: `docs/plan/00-master.md` §2.5. |
| Washer payments | Earned per period = `sum(commissionAmount)` of `done` orders in the period (cancelled earn 0). Payments are events in `washerPayments` (who, when, amount, `periodKey`, `source`), never edited or deleted; mistakes fixed by an admin `correction` entry. Balance owed = all-time earned − all-time payments and corrections; a payment above it → `validation` (no advances: decided by Opus, David may change it; nothing is paid that was not earned, so the balance never needs a debt rule). Only washer commissions are tracked, no operator salaries (decided by Opus, David may change it; nothing in the core flow needs them). A till payment to an inactive or unknown washer → `not_found` (05 finding 16). **Cash rule (decided by Opus; David may change it):** `source: 'till'` is recorded by an operator in an open shift and subtracted from `expectedCash`; `source: 'outside'` is recorded by the admin and never touches a shift. Reason: unrecorded till payments would show as a false shortage at every close, and the admin does not operate shifts. Build: P2 field, P3 till payment and close, P4 admin view, outside payments and cash flow per period. |
| Plates | Normalize (uppercase, strip spaces and dashes). Car `^[A-Z]{3}\d{3}$`, motorcycle `^[A-Z]{3}\d{2}[A-Z]?$`. Special or foreign plates are allowed, typed by hand with the "Placa especial" flag (David): checked against `^[A-Z0-9]{2,10}$`, stored in the same `plate` field and `vehicles/{plate}` doc with `plateSpecial: true`, badged "Especial" in history. A flagged plate that matches the standard format is stored as standard (Opus, 2026-10-29). |
| Block status | `status` lives on the business doc. Backend checks it on every request. Rules check it with `get()` on direct client reads only. No refresh-token revocation: the per-request checks already deny, and revocation would force a new sign-in after unblocking (Opus, 02b). |
| Billing | Monthly fee per business (integer COP). `paidUntil` drives alerts. Blocking is manual, so there is no grace-period logic: overdue means `paidUntil < today`. Expiry alert window 5 days, configurable by superadmin. In-app only (Opus, 02b). |
| Owner's share | Not stored. Computed as `finalPrice − commissionAmount` for a `done` order and 0 for a cancelled one, from the frozen order fields, by one pure function in `src/domain/order.js` (P3). Negative for a courtesy: that is the cost the business absorbs. Deviation from spec §3 "store it": every input is frozen, so the value cannot drift, and sums stay linear (`sum(finalPrice) − sum(commissionAmount)`) for Firestore `sum()` (Opus, 02b). |
| Catalog permissions | Only the business owner (role admin) changes the catalog, prices and washer percentages included. Operators cannot (`forbidden`). No note is required for a price or percentage change; who and when are recorded for commission changes only (David, A3). |
| Price matrix | Complete: every active category × active wash type of a business has a price (integer, ≥ 1). A missing price is not an allowed state. Creating a category or wash type takes the prices for every active counterpart in the same save, else `price_missing`; no auto-filled prices (David, rule; Opus, mechanism, A3). |
| Catalog changes | Nothing is deleted, prices included: categories, wash types and washers are deactivated. Deactivating is always allowed and keeps prices. Reactivating re-checks cc overlap (active motorcycle categories of the business) and price completeness. No order can be created against a deactivated item (`not_found`); existing orders keep their snapshot. Changes apply only to new orders (Opus, A3). |
| Payment methods | `cash` and `qr`. Recorded only, no integration. Chosen at "Lavada terminada", not at creation. |
| Backend runtime | Google Cloud Functions 2nd gen, in the Firebase project, which must be on Blaze (its billing account is in Google Cloud Billing). David creates the billing account. Not needed during Part A. Budget alert set before any Functions deploy (Part B). |

## Data model

Per the kickoff spec (`lavadero-prompt.md`, section 3), with the changes above. Tenant data lives under `businesses/{businessId}`, and every tenant document also stores `businessId`.

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm test` — unit tests with `node --test` (no test framework dependency)
- `npm run build` — production build into `dist/`

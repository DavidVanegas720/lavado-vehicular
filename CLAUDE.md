# CLAUDE.md

Multi-tenant SaaS for car and motorcycle wash businesses (lavaderos) in Colombia.
Full kickoff spec: `lavadero-prompt.md`. This file holds the decisions taken so far and the working rules.
Code, identifiers, comments and file contents are in English. User-facing UI text is in Spanish (Colombia).

## Working rules

- **Models:** Opus analyzes, builds every plan (`docs/tasks/NN-name.md`) and makes every decision: product, domain, design, scope, naming, rules and the order of work. It runs as an Opus subagent. Sonnet and Haiku only write code that follows an Opus plan; they do not decide. Haiku for mechanical, low-risk edits (boilerplate, fixtures, renames); Sonnet for logic, money, security and rules. Any decision a Sonnet or Haiku agent meets while coding goes back to Opus, not into the code.
- **Ponytail:** the ponytail skill applies to all work: planning, code, review and reports.
- **Commits:** no `Co-Authored-By` line and no AI attribution in commit messages or PR descriptions. English, imperative subject line.
- **Git:** Claude does not commit or push unless David asks for it. Never rewrite history.
- **Process:** plan first (`docs/tasks/NN-name.md`: goal, decisions, acceptance criteria, status), then implement. Every phase ends at a checkpoint.
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

- Part A (frontend, mock layer): A0 plan → A1 skeleton → A2 core wash flow → A3 catalog → A4 daily close → A5 plate history → A6 cars → A7 superadmin → A8 review.
- Part B (backend, replaces mock module by module): B1 Firebase/emulators → B2 rules → B3 core flow transaction → B4 catalog/close/history → B5 cars gating → B6 superadmin backend → B7 deploy.
- From A1: contract tests run against the mock and enforce tenant isolation, admin-only history and blocked business. They run against the real backend in B4.

## Domain decisions

| Topic | Decision |
|-------|----------|
| Money | Integer COP pesos. No floats, no decimals, no centavos. |
| Commission | `commissionAmount = Math.floor((listPrice * commissionBp + 5000) / 10000)` (half up, integer math). Base is always `listPrice`. |
| Commission rate changes | Apply only to orders created afterwards. Old orders keep their snapshot. |
| Commission history | Subcollection `businesses/{bid}/washers/{id}/commissionHistory` (rate, effectiveFrom, changedBy). Audit only, never used to compute. |
| Courtesy | `finalPrice = 0`, `isCourtesy = true`, `courtesyReason` required and non-empty. Backend rejects otherwise. |
| Operator order visibility | Option (a): operators have no client read on `orders`. The backend returns their own orders for the current business day. Admins read through the repository. |
| Order edits | None. Orders are never edited. Cancel sets `status: 'cancelled'`, `cancelledBy`, `cancelledAt`. Cancelled orders are excluded from totals and kept in history. |
| Order snapshot | Copy `categoryName`, `ccMin`, `ccMax`, `washTypeName`, `listPrice`, `washerName`, `commissionBp`, `commissionAmount`. |
| Category check | Client suggests the category from cc. Backend re-checks that the cc falls in the category's range; rejects otherwise. |
| Transaction | Backend reads categories, prices and washer inside the same transaction that writes the order and updates `vehicles/{plate}`. Never reads prices from the client. |
| Hot documents | No counters on business or washer docs. Washer doc is not written per order. |
| Users | One business per user. Claim `businessId` plus role. |
| Day and week | Calendar day and Monday-start week, `America/Bogota`, computed on the server. One function `businessDay()` for the whole app. |
| Plates | Normalize (uppercase, strip spaces and dashes). Car `^[A-Z]{3}\d{3}$`, motorcycle `^[A-Z]{3}\d{2}[A-Z]?$`. Special plates rejected in the MVP. |
| Block status | `status` lives on the business doc. Backend checks it on every request. Rules check it with `get()` on direct client reads only. No refresh-token revocation: the per-request checks already deny, and revocation would force a new sign-in after unblocking (Opus, 02b). |
| Billing | Monthly fee per business (integer COP). `paidUntil` drives alerts. Blocking is manual, so there is no grace-period logic: overdue means `paidUntil < today`. Expiry alert window 5 days, configurable by superadmin. In-app only (Opus, 02b). |
| Owner's share | Not stored. Computed as `finalPrice − commissionAmount` from the frozen order fields, by one pure function in `src/domain/commission.js` (A4). Negative for a courtesy: that is the cost the business absorbs. Deviation from spec §3 "store it": every input is frozen, so the value cannot drift, and sums stay linear (`sum(finalPrice) − sum(commissionAmount)`) for Firestore `sum()` (Opus, 02b). |
| Catalog changes | Nothing is deleted: categories, wash types and washers are deactivated. cc ranges must not overlap among active motorcycle categories of a business (checked on save and on reactivate). A missing price means the category × wash type pair is not offered. Changes apply only to new orders (Opus, A3). |
| Payment methods | `cash` and `qr`. Recorded only, no integration. |
| Backend runtime | Google Cloud Functions 2nd gen, in the Firebase project, which must be on Blaze (its billing account is in Google Cloud Billing). David creates the billing account. Not needed during Part A. Budget alert set before any Functions deploy (Part B). |

## Data model

Per the kickoff spec (`lavadero-prompt.md`, section 3), with the changes above. Tenant data lives under `businesses/{businessId}`, and every tenant document also stores `businessId`.

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm test` — unit tests with `node --test` (no test framework dependency)
- `npm run build` — production build into `dist/`

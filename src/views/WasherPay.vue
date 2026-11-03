<script setup>
import { ref, reactive, onMounted } from 'vue'
import { listWasherBalances, getWasherLedger, recordOutsidePayment, recordCorrection } from '../services/washerPay.js'
import { getCashFlow } from '../services/cashFlow.js'
import { getShiftStatus } from '../services/shifts.js'
import { formatCOP, parsePesos } from '../domain/money.js'
import { PAY_FREQUENCIES } from '../domain/catalog.js'
import { errorText } from './messages.js'

const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const input = `min-h-11 w-full rounded border border-slate-400 px-3 ${focus}`
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white hover:bg-blue-800 motion-reduce:transition-none ${focus}`
const btn2 = `min-h-11 rounded border border-slate-400 px-4 hover:bg-slate-100 motion-reduce:transition-none ${focus}`
const card = 'rounded border border-slate-300 p-3 space-y-2'
const radio = 'flex min-h-11 items-center gap-2'
const msgs = { validation: 'Revisá los datos: el monto debe ser válido (y un pago no puede superar lo que se le debe), y el motivo de 1 a 200 letras.' }
const KINDS = { payment: 'Pago', correction: 'Corrección' }

const balances = ref([])
const error = ref('')
const success = ref('')
const open = ref(null) // washer id with ledger shown
const ledger = ref(null)
const pay = reactive({ washerId: '', amount: '', period: 'previous', note: '' })
const fix = reactive({ washerId: '', amount: '', minus: false, reason: '' })
const flow = reactive({ periodType: 'daily', businessDate: '' })
const cash = ref(null)

const when = (d) => new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota' })

function load() { balances.value = listWasherBalances() }

function fail(e) {
  success.value = ''
  error.value = errorText(e, msgs)
}

// Runs an action: clears messages, shows errorText on failure. Returns true on success.
function run(fn, ok) {
  error.value = ''
  success.value = ''
  try { fn(); success.value = ok; return true } catch (e) { fail(e); return false }
}

function reload() {
  load()
  if (open.value) ledger.value = getWasherLedger(open.value)
}

function toggle(id) {
  error.value = ''
  if (open.value === id) { open.value = null; ledger.value = null; return }
  try { ledger.value = getWasherLedger(id); open.value = id } catch (e) { fail(e); try { load() } catch { /* shown above */ } }
}

function amountOrError(text) {
  const n = parsePesos(text)
  if (!n) { success.value = ''; error.value = 'Escribí el monto en pesos, solo números (ej. 50.000).'; return null }
  return n
}

function submitPay() {
  error.value = ''
  success.value = ''
  const amount = amountOrError(pay.amount)
  if (amount === null) return
  if (run(() => { recordOutsidePayment({ washerId: pay.washerId, amount, period: pay.period, note: pay.note }); reload() }, 'Pago registrado.')) {
    Object.assign(pay, { amount: '', note: '' })
  }
}

function submitFix() {
  error.value = ''
  success.value = ''
  const n = amountOrError(fix.amount)
  if (n === null) return
  if (run(() => { recordCorrection({ washerId: fix.washerId, amount: fix.minus ? -n : n, reason: fix.reason }); reload() }, 'Corrección registrada.')) {
    Object.assign(fix, { amount: '', minus: false, reason: '' })
  }
}

function showFlow() {
  error.value = ''
  success.value = ''
  try { cash.value = getCashFlow({ ...flow }); success.value = 'Flujo actualizado.' } catch (e) { error.value = errorText(e, { validation: 'Elegí una fecha válida.' }) }
}

onMounted(() => { try { flow.businessDate = getShiftStatus().current.businessDate; load() } catch (e) { fail(e) } })
</script>

<template>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
  <p v-if="success" role="status" class="mb-4 rounded bg-green-100 p-3 text-green-900">{{ success }}</p>

  <h1 class="mb-4 text-xl font-bold">Pago a lavadores</h1>

  <ul class="mb-6 space-y-3">
    <li v-for="w in balances" :key="w.washerId" :class="card">
      <p class="font-bold">{{ w.name }}<template v-if="!w.active"> (inactivo)</template></p>
      <p v-if="w.balanceOwed < 0">Saldo a favor del negocio: {{ formatCOP(-w.balanceOwed) }}</p>
      <p v-else>Se le debe: {{ formatCOP(w.balanceOwed) }}</p>
      <p>Período actual ({{ w.current.periodKey }}): ganó {{ formatCOP(w.current.earned) }}, pagado {{ formatCOP(w.current.paid) }}</p>
      <p>Período anterior ({{ w.previous.periodKey }}): ganó {{ formatCOP(w.previous.earned) }}, pagado {{ formatCOP(w.previous.paid) }}</p>
      <button type="button" :class="btn2" :aria-expanded="open === w.washerId" @click="toggle(w.washerId)">
        Ver detalle<span class="sr-only"> de {{ w.name }}</span>
      </button>
      <div v-if="open === w.washerId && ledger" class="space-y-2">
        <h3 class="font-bold">Períodos</h3>
        <p v-if="!ledger.periods.length">Sin lavadas.</p>
        <ul v-else class="space-y-1">
          <li v-for="p in ledger.periods" :key="p.periodKey">{{ p.periodKey }}: ganó {{ formatCOP(p.earned) }}, pagado {{ formatCOP(p.paid) }}</li>
        </ul>
        <h3 class="font-bold">Movimientos</h3>
        <p v-if="!ledger.entries.length">Sin movimientos.</p>
        <ul v-else class="space-y-1">
          <li v-for="(en, i) in ledger.entries" :key="i">
            {{ when(en.paidAt) }} · {{ KINDS[en.type] }} {{ formatCOP(en.amount) }}<template v-if="en.type === 'payment'"> · {{ en.periodKey }} · {{ en.source === 'till' ? 'Caja' : 'Fuera de caja' }}</template><template v-if="en.note || en.reason"> · {{ en.note || en.reason }}</template>
          </li>
        </ul>
      </div>
    </li>
  </ul>

  <form :class="[card, 'mb-6']" @submit.prevent="submitPay">
    <h2 class="font-bold">Registrar pago</h2>
    <label for="pp-w" class="block">Lavador</label>
    <select id="pp-w" v-model="pay.washerId" :class="input" @change="pay.period = balances.find((w) => w.washerId === pay.washerId)?.payFrequency === 'daily' ? 'current' : 'previous'">
      <option value="" disabled>Elegí un lavador</option>
      <option v-for="w in balances" :key="w.washerId" :value="w.washerId">{{ w.name }}<template v-if="!w.active"> (inactivo)</template></option>
    </select>
    <label for="pp-a" class="block">Monto</label>
    <input id="pp-a" v-model="pay.amount" type="text" inputmode="numeric" autocomplete="off" :class="input" />
    <fieldset>
      <legend>Período</legend>
      <label :class="radio"><input v-model="pay.period" type="radio" name="pp-p" value="previous" class="size-5" />Anterior</label>
      <label :class="radio"><input v-model="pay.period" type="radio" name="pp-p" value="current" class="size-5" />Actual</label>
    </fieldset>
    <label for="pp-n" class="block">Nota</label>
    <input id="pp-n" v-model="pay.note" type="text" maxlength="200" :class="input" />
    <button type="submit" :class="btn">Registrar pago</button>
  </form>

  <form :class="[card, 'mb-6']" @submit.prevent="submitFix">
    <h2 class="font-bold">Corrección</h2>
    <label for="co-w" class="block">Lavador</label>
    <select id="co-w" v-model="fix.washerId" :class="input">
      <option value="" disabled>Elegí un lavador</option>
      <option v-for="w in balances" :key="w.washerId" :value="w.washerId">{{ w.name }}<template v-if="!w.active"> (inactivo)</template></option>
    </select>
    <label for="co-a" class="block">Monto</label>
    <input id="co-a" v-model="fix.amount" type="text" inputmode="numeric" autocomplete="off" :class="input" />
    <label :class="radio"><input v-model="fix.minus" type="checkbox" class="size-5" aria-describedby="co-h" />Sube lo que se le debe</label>
    <p id="co-h" class="text-sm">Sin marcar: baja lo que se le debe. Marcada: sube lo que se le debe.</p>
    <label for="co-r" class="block">Motivo</label>
    <input id="co-r" v-model="fix.reason" type="text" maxlength="200" :class="input" />
    <button type="submit" :class="btn">Registrar corrección</button>
  </form>

  <section :class="card" aria-labelledby="cf-h">
    <h2 id="cf-h" class="font-bold">Flujo de caja</h2>
    <form class="space-y-2" @submit.prevent="showFlow">
      <fieldset>
        <legend>Período</legend>
        <label v-for="(label, key) in PAY_FREQUENCIES" :key="key" :class="radio">
          <input v-model="flow.periodType" type="radio" name="cf-t" :value="key" class="size-5" />{{ label }}
        </label>
      </fieldset>
      <label for="cf-d" class="block">Fecha</label>
      <input id="cf-d" v-model="flow.businessDate" type="date" :class="input" />
      <button type="submit" :class="btn">Ver</button>
    </form>
    <div v-if="cash" class="space-y-1">
      <p>Del {{ cash.period.start }} al {{ cash.period.end }}</p>
      <p class="font-bold">Entra: {{ formatCOP(cash.in.total) }}</p>
      <p>Efectivo {{ formatCOP(cash.in.cash) }} · QR {{ formatCOP(cash.in.qr) }}</p>
      <p class="font-bold">Sale: {{ formatCOP(cash.out.total) }}</p>
      <p>Caja {{ formatCOP(cash.out.till) }} · Fuera de caja {{ formatCOP(cash.out.outside) }} · Devoluciones {{ formatCOP(cash.out.refunds) }}</p>
      <p>Correcciones: {{ formatCOP(cash.corrections) }}</p>
      <p class="font-bold">Se debe a lavadores: {{ formatCOP(cash.owed) }}</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getShiftStatus, getClosePreview, closeShift, reopenShift } from '../services/shifts.js'
import { listTillPayables, recordTillPayment } from '../services/washerPay.js'
import { formatCOP, parsePesos } from '../domain/money.js'
import { PAYMENT_METHODS } from '../domain/order.js'
import { errorText } from './messages.js'

const input = 'min-h-11 w-full rounded border border-slate-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const row = 'flex min-h-11 items-center gap-2'
const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white hover:bg-blue-800 disabled:opacity-50 motion-reduce:transition-none ${focus}`
const msgs = { validation: 'El monto no puede superar el saldo a pagar.', invalid_state: 'Este turno ya cambió. Actualizamos la lista.' }
const card = 'rounded border border-slate-300 p-3'
const dateOf = (k) => k.split('_')[0]

const instances = ref([]) // previews of open instances, each with `ended`
const recentClosed = ref([])
const payables = ref([])
const selectedKey = ref('')
const washerId = ref('')
const amountText = ref('')
const period = ref('current')
const countText = ref('')
const reopenKey = ref('')
const reopenReason = ref('')
const error = ref('')
const success = ref('')
const result = ref(null)
const busy = ref(false)

const selected = computed(() => instances.value.find((i) => i.shiftKey === selectedKey.value))
const blocked = computed(() => !selected.value || !selected.value.ended || selected.value.unfinished.length > 0)
const time = (d) => d.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false })

async function load() {
  const st = await getShiftStatus()
  // an instance past its end is exactly one listed in `unclosed`, so the view needs no clock
  const keys = [...st.unclosed.map((u) => [u.shiftKey, true]), ...(st.current.state === 'open' ? [[st.current.shiftKey, false]] : [])]
  instances.value = await Promise.all(keys.map(async ([k, ended]) => ({ ...(await getClosePreview(k)), ended })))
  recentClosed.value = st.recentClosed
  payables.value = await listTillPayables()
  if (!instances.value.some((i) => i.shiftKey === selectedKey.value)) selectedKey.value = instances.value[0]?.shiftKey ?? ''
  if (!payables.value.some((w) => w.washerId === washerId.value)) washerId.value = ''
}
async function run(fn, done) {
  error.value = ''
  success.value = ''
  busy.value = true
  try { await fn(); success.value = done } catch (e) { error.value = errorText(e, msgs) } finally { busy.value = false }
  try { await load() } catch (e) { error.value = errorText(e) }
}

onMounted(async () => { try { await load() } catch (e) { error.value = errorText(e) } })

function pickWasher(w) {
  washerId.value = w.washerId
  amountText.value = String(w.balanceOwed)
  period.value = w.payFrequency === 'daily' ? 'current' : 'previous'
}

async function pay() {
  const amount = parsePesos(amountText.value)
  if (!washerId.value || !amount) { error.value = 'Elegí un lavador y escribí un monto mayor a cero.'; success.value = ''; return }
  await run(() => recordTillPayment(selectedKey.value, { washerId: washerId.value, amount, period: period.value }), 'Pago registrado.')
  if (!error.value) { amountText.value = ''; washerId.value = '' }
}

async function close() {
  const countedCash = parsePesos(countText.value)
  if (countedCash === null) { error.value = 'Escribí el efectivo contado en pesos, sin decimales.'; success.value = ''; return }
  error.value = ''
  success.value = ''
  busy.value = true
  try { result.value = await closeShift(selectedKey.value, { countedCash }); countText.value = '' } catch (e) { error.value = errorText(e, msgs) } finally { busy.value = false }
  try { await load() } catch (e) { error.value = errorText(e) }
}

async function reopen() {
  const reason = reopenReason.value.trim()
  if (!reopenKey.value || reason.length < 1 || reason.length > 200) { error.value = 'Elegí el turno y escribí el motivo (1 a 200 caracteres).'; success.value = ''; return }
  await run(() => reopenShift(reopenKey.value, { reason }), 'Turno reabierto.')
  if (!error.value) { reopenReason.value = ''; reopenKey.value = ''; result.value = null }
}
</script>

<template>
  <h1 class="mb-4 text-xl font-bold">Cierre de turno</h1>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
  <p v-if="success" role="status" class="mb-4 rounded bg-green-100 p-3 text-green-900">{{ success }}</p>
  <section v-if="result" role="status" class="mb-4 rounded bg-green-100 p-3 text-green-900" aria-label="Resultado del cierre">
    <p class="font-bold">Turno cerrado</p>
    <p>Esperado: {{ formatCOP(result.expectedCash) }}</p>
    <p>Contado: {{ formatCOP(result.countedCash) }}</p>
    <p>Diferencia: {{ formatCOP(result.difference) }}</p>
  </section>

  <p v-if="!instances.length">No hay turnos abiertos para cerrar.</p>

  <fieldset v-if="instances.length" class="mb-6 space-y-3">
    <legend class="mb-2 text-lg font-bold">Turno a cerrar</legend>
    <label v-for="i in instances" :key="i.shiftKey" :class="`${card} block`">
      <span :class="row">
        <input v-model="selectedKey" type="radio" name="instance" :value="i.shiftKey" :aria-labelledby="`inst-${i.shiftKey}`" class="size-5" />
        <span :id="`inst-${i.shiftKey}`" class="font-bold">{{ i.shiftName }} {{ dateOf(i.shiftKey) }}</span>
      </span>
      <span class="block">Base: {{ formatCOP(i.openingCash) }}</span>
      <span v-for="(v, m) in i.salesByMethod" :key="m" class="block">Ventas {{ PAYMENT_METHODS[m] }}: {{ formatCOP(v) }}</span>
      <span class="block">
        Pagos a lavadores de caja:
        <template v-if="i.tillPayments.length">{{ i.tillPayments.map((p) => `${p.washerName} ${formatCOP(p.amount)}`).join(', ') }}</template>
        <template v-else>ninguno</template>
      </span>
      <span class="block">Órdenes sin terminar: {{ i.unfinished.length }}</span>
    </label>
  </fieldset>

  <template v-if="selected">
    <form class="mb-6 space-y-3" aria-labelledby="pay-h" @submit.prevent="pay">
      <h2 id="pay-h" class="text-lg font-bold">Pago a lavador</h2>
      <fieldset class="space-y-3">
        <legend class="sr-only">Lavador</legend>
        <label v-for="w in payables" :key="w.washerId" :class="`${card} block`">
          <span :class="row">
            <input type="radio" name="payWasher" :value="w.washerId" :checked="washerId === w.washerId" class="size-5" @change="pickWasher(w)" />
            <span class="font-bold">{{ w.name }}</span>
          </span>
          <span v-if="w.balanceOwed < 0" class="block">Saldo a favor del negocio: {{ formatCOP(-w.balanceOwed) }}</span>
          <span v-else class="block">Saldo a pagar: {{ formatCOP(w.balanceOwed) }}</span>
          <span class="block">Ganado en el periodo actual: {{ formatCOP(w.currentEarned) }}</span>
        </label>
      </fieldset>
      <div>
        <label for="amount" class="block">Monto a pagar</label>
        <input id="amount" v-model="amountText" type="text" inputmode="numeric" autocomplete="off" :class="input" />
      </div>
      <fieldset>
        <legend>Periodo</legend>
        <label :class="row"><input v-model="period" type="radio" name="period" value="previous" class="size-5" /> Periodo anterior</label>
        <label :class="row"><input v-model="period" type="radio" name="period" value="current" class="size-5" /> Periodo actual</label>
      </fieldset>
      <button type="submit" :disabled="busy" :class="btn">Registrar pago</button>
    </form>

    <form class="mb-6 space-y-3" aria-labelledby="close-h" @submit.prevent="close">
      <h2 id="close-h" class="text-lg font-bold">Cerrar turno</h2>
      <div v-if="selected.unfinished.length">
        <p class="font-bold">Sin terminar</p>
        <ul class="space-y-2">
          <li v-for="o in selected.unfinished" :key="o.id" :class="card">{{ o.plate }} — {{ o.createdByName }}</li>
        </ul>
      </div>
      <p v-if="!selected.ended">Este turno termina a las {{ time(selected.endsAt) }}.</p>
      <div>
        <label for="count" class="block">Efectivo contado</label>
        <input id="count" v-model="countText" type="text" inputmode="numeric" autocomplete="off" :class="input" />
      </div>
      <button type="submit" :disabled="blocked || busy" :class="btn">Cerrar turno</button>
    </form>
  </template>

  <form v-if="recentClosed.length" class="mb-6 space-y-3" aria-labelledby="reopen-h" @submit.prevent="reopen">
    <h2 id="reopen-h" class="text-lg font-bold">Reabrir turno</h2>
    <fieldset class="space-y-3">
      <legend class="sr-only">Turno cerrado</legend>
      <label v-for="c in recentClosed" :key="c.shiftKey" :class="`${card} ${row}`">
        <input v-model="reopenKey" type="radio" name="reopen" :value="c.shiftKey" class="size-5" />
        {{ c.shiftName }} {{ dateOf(c.shiftKey) }} — terminó a las {{ time(c.endsAt) }}
      </label>
    </fieldset>
    <div>
      <label for="reopen-reason" class="block">Motivo de la reapertura</label>
      <input id="reopen-reason" v-model="reopenReason" type="text" maxlength="200" :class="input" />
    </div>
    <button type="submit" :disabled="busy" :class="btn">Reabrir turno</button>
  </form>
</template>

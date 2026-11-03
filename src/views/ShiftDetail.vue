<script setup>
import { ref, computed, onMounted } from 'vue'
import { getShiftInstance } from '../services/shifts.js'
import { cancelOrder } from '../services/orders.js'
import { formatCOP } from '../domain/money.js'
import { PAYMENT_METHODS } from '../domain/order.js'
import { errorText } from './messages.js'

const props = defineProps({ shiftKey: { type: String, required: true } })

const input = 'min-h-11 w-full rounded border border-slate-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white hover:bg-blue-800 disabled:opacity-50 motion-reduce:transition-none ${focus}`
const card = 'rounded border border-slate-300 p-3'
const status = { in_progress: 'En proceso', done: 'Terminada', cancelled: 'Anulada' }

const data = ref(null)
const error = ref('')
const success = ref('')
const operatorId = ref('')
const onlyCourtesy = ref(false)
const actionId = ref('') // order with its form open
const reason = ref('')
const washerPaid = ref('') // 'yes' | 'no' | ''

const time = (d) => d.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short', hour12: false })
const operators = computed(() => [...new Map((data.value?.orders ?? []).map((o) => [o.createdBy, o.createdByName]))])
const orders = computed(() => (data.value?.orders ?? []).filter((o) => (!operatorId.value || o.createdBy === operatorId.value) && (!onlyCourtesy.value || o.isCourtesy)))
const snap = computed(() => data.value?.latestClose?.totals)

function load() {
  try { data.value = getShiftInstance(props.shiftKey) } catch (e) { error.value = errorText(e) }
}
onMounted(load)

function open(o) { actionId.value = o.id; reason.value = ''; washerPaid.value = ''; error.value = ''; success.value = '' }

function submit(o) {
  const text = reason.value.trim()
  const refund = o.status === 'done'
  if (!text || text.length > 200 || (refund && !washerPaid.value)) {
    error.value = refund ? 'Escribí el motivo (1 a 200 caracteres) y respondé si se le paga la comisión al lavador.' : 'Escribí el motivo (1 a 200 caracteres).'
    success.value = ''
    return
  }
  error.value = ''
  success.value = ''
  try {
    cancelOrder(o.id, refund ? { reason: text, washerPaid: washerPaid.value === 'yes' } : { reason: text })
    success.value = refund ? 'Dinero devuelto.' : 'Orden anulada.'
    actionId.value = ''
  } catch (e) { error.value = errorText(e, { shift_not_open: 'Para devolver efectivo, un operador tiene que abrir el turno actual.' }) }
  load()
}
</script>

<template>
  <section v-if="data" aria-labelledby="detail-h" class="space-y-6">
    <h2 id="detail-h" class="text-lg font-bold">Detalle del turno</h2>
    <p v-if="error" role="alert" class="rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
    <p v-if="success" role="status" class="rounded bg-green-100 p-3 text-green-900">{{ success }}</p>

    <div>
      <h3 class="mb-2 font-bold">Historial</h3>
      <ul class="space-y-2">
        <li v-for="(e, n) in data.events" :key="n" :class="card">
          <template v-if="e.type === 'open'"><b>Abrió</b> con base {{ formatCOP(e.openingCash) }}</template>
          <template v-else-if="e.type === 'close'"><b>Cerró</b> — contado {{ formatCOP(e.countedCash) }}, esperado {{ formatCOP(e.expectedCash) }}, diferencia {{ formatCOP(e.difference) }}</template>
          <template v-else><b>Reabrió</b> — motivo: {{ e.reason }}</template>
          <span class="block">{{ e.byName }} — {{ time(e.at) }}</span>
        </li>
      </ul>
    </div>

    <div v-if="snap" :class="card">
      <h3 class="mb-2 font-bold">Último cierre</h3>
      <p v-for="(v, m) in snap.salesByMethod" :key="m">Ventas {{ PAYMENT_METHODS[m] }}: {{ formatCOP(v) }}</p>
      <p>Devoluciones: {{ snap.refundsCount }} ({{ formatCOP(snap.refundsAmount) }})</p>
      <p v-if="snap.refundsByMethod" v-for="(v, m) in snap.refundsByMethod" :key="'r' + m">Devoluciones {{ PAYMENT_METHODS[m] }}: {{ formatCOP(v) }}</p>
      <p v-for="(w, id) in snap.washerPay" :key="id">Pago a {{ w.name }}: {{ formatCOP(w.amount) }}</p>
      <p>Parte del dueño: {{ formatCOP(snap.ownerShare) }}</p>
      <p>
        Pagos de caja:
        <template v-if="data.tillPayments.length">{{ data.tillPayments.map((p) => `${p.washerName} ${formatCOP(p.amount)}`).join(', ') }}</template>
        <template v-else>ninguno</template>
      </p>
    </div>

    <div>
      <h3 class="mb-2 font-bold">Órdenes</h3>
      <div class="mb-3 space-y-3">
        <div>
          <label for="f-operator" class="block">Operador</label>
          <select id="f-operator" v-model="operatorId" :class="input">
            <option value="">Todos</option>
            <option v-for="[id, name] in operators" :key="id" :value="id">{{ name }}</option>
          </select>
        </div>
        <label class="flex min-h-11 items-center gap-2"><input v-model="onlyCourtesy" type="checkbox" class="size-5" /> Solo cortesías</label>
      </div>
      <p v-if="!orders.length">No hay órdenes.</p>
      <ul class="space-y-2">
        <li v-for="o in orders" :key="o.id" :class="card">
          <p class="font-bold">{{ o.plate }} — {{ status[o.status] }}</p>
          <p>{{ o.washTypeName }}, {{ o.categoryName }} — {{ formatCOP(o.finalPrice) }}</p>
          <p>Lavador: {{ o.washerName }} — Operador: {{ o.createdByName }}</p>
          <p v-if="o.isCourtesy">Cortesía: {{ o.courtesyReason }}</p>
          <p v-if="o.status === 'cancelled'">{{ o.isRefund ? 'Devolución' : 'Anulada' }}: {{ o.cancelReason }}<template v-if="o.isRefund"> (comisión al lavador: {{ o.washerPaid ? 'sí' : 'no' }})</template></p>
          <button v-if="(o.status === 'in_progress' || (o.status === 'done' && o.finalPrice > 0)) && actionId !== o.id" type="button" :class="`${btn} mt-2`" :aria-label="`${o.status === 'done' ? 'Devolver dinero' : 'Anular'} orden de ${o.plate}`" @click="open(o)">
            {{ o.status === 'done' ? 'Devolver dinero' : 'Anular' }}
          </button>
          <form v-if="actionId === o.id" class="mt-2 space-y-3" @submit.prevent="submit(o)">
            <div>
              <label :for="`r-${o.id}`" class="block">Motivo</label>
              <input :id="`r-${o.id}`" v-model="reason" type="text" maxlength="200" :class="input" />
            </div>
            <fieldset v-if="o.status === 'done'">
              <legend>¿Se le paga la comisión al lavador?</legend>
              <label class="flex min-h-11 items-center gap-2"><input v-model="washerPaid" type="radio" :name="`wp-${o.id}`" value="yes" class="size-5" /> Sí</label>
              <label class="flex min-h-11 items-center gap-2"><input v-model="washerPaid" type="radio" :name="`wp-${o.id}`" value="no" class="size-5" /> No</label>
            </fieldset>
            <button type="submit" :class="btn" :aria-label="`${o.status === 'done' ? 'Devolver dinero' : 'Anular'} orden de ${o.plate}`">{{ o.status === 'done' ? 'Devolver dinero' : 'Anular' }}</button>
          </form>
        </li>
      </ul>
    </div>
  </section>
  <p v-else-if="error" role="alert" class="rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
</template>

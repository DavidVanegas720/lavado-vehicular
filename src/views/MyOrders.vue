<script setup>
import { ref, computed, onMounted } from 'vue'
import { listShiftOrders, finishOrder, cancelOrder } from '../services/orders.js'
import { getShiftStatus } from '../services/shifts.js'
import { formatCOP } from '../domain/money.js'
import { PAYMENT_METHODS } from '../domain/order.js'
import { errorText } from './messages.js'

const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const input = `min-h-11 w-full rounded border border-slate-400 px-3 ${focus}`
const btn = `min-h-11 rounded border border-slate-500 px-4 hover:bg-slate-100 motion-reduce:transition-none ${focus}`
const STATUS = { in_progress: 'En curso', done: 'Terminada', cancelled: 'Anulada' }

const orders = ref([])
const currentKey = ref('')
const payment = ref({})
const cancelling = ref(null)
const reason = ref('')
const error = ref('')
const busy = ref(false)

const inProgress = computed(() => orders.value.filter((o) => o.status === 'in_progress'))
const rest = computed(() => orders.value.filter((o) => o.status !== 'in_progress'))
const time = (d) => d.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false })

async function load() {
  orders.value = await listShiftOrders()
  currentKey.value = (await getShiftStatus()).current.shiftKey
}
async function run(fn) {
  error.value = ''
  busy.value = true
  try { await fn(); cancelling.value = null; reason.value = '' } catch (e) {
    error.value = e.code === 'validation' ? 'Escribí el motivo de la anulación (máximo 200 caracteres).' : errorText(e)
  } finally { busy.value = false }
  try { await load() } catch { /* error already shown */ }
}
async function finish(o) {
  if (!payment.value[o.id]) { error.value = 'Elegí el método de pago.'; return }
  await run(() => finishOrder(o.id, { paymentMethod: payment.value[o.id] }))
}
const cancel = (o) => run(() => cancelOrder(o.id, { reason: reason.value }))

onMounted(async () => { try { await load() } catch (e) { error.value = errorText(e) } })
</script>

<template>
  <h1 class="mb-4 text-xl font-bold">Mis órdenes del turno</h1>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
  <p v-if="!orders.length">Todavía no registraste lavadas en este turno.</p>

  <template v-for="section in [
    { title: 'En curso', list: inProgress },
    { title: 'Terminadas y anuladas', list: rest },
  ]" :key="section.title">
    <section v-if="section.list.length" class="mb-6" :aria-label="section.title">
      <h2 class="mb-2 text-lg font-bold">{{ section.title }}</h2>
      <ul class="space-y-3">
        <li v-for="o in section.list" :key="o.id" class="rounded border border-slate-300 p-3">
          <p class="font-bold">
            {{ o.plate }}
            <span v-if="o.plateSpecial" class="rounded bg-slate-200 px-2 text-sm">Especial</span>
            <span v-if="o.shiftKey !== currentKey" class="rounded bg-yellow-100 px-2 text-sm">Turno anterior</span>
          </p>
          <p>{{ o.washTypeName }} · {{ o.categoryName }}<template v-if="o.vehicleType === 'car'"> · Carro</template> · {{ o.washerName }}</p>
          <p>{{ formatCOP(o.finalPrice) }} · {{ time(o.createdAt) }} · {{ STATUS[o.status] }}</p>
          <p v-if="o.isCourtesy">Cortesía: {{ o.courtesyReason }}</p>
          <p v-if="o.status === 'done'">{{ PAYMENT_METHODS[o.paymentMethod] }}</p>
          <p v-if="o.status === 'cancelled'">Anulada: {{ o.cancelReason }}</p>

          <div v-if="o.status === 'in_progress'" class="mt-2 space-y-2">
            <fieldset>
              <legend class="sr-only">Método de pago de {{ o.plate }}</legend>
              <label v-for="(label, key) in PAYMENT_METHODS" :key="key" class="mr-4 inline-flex min-h-11 items-center gap-2">
                <input v-model="payment[o.id]" type="radio" :name="`pay-${o.id}`" :value="key" class="size-5" />
                {{ label }}
              </label>
            </fieldset>
            <div class="flex flex-wrap gap-2">
              <button type="button" :disabled="busy" :class="btn" @click="finish(o)">Lavada terminada</button>
              <button type="button" :class="btn" @click="cancelling = o.id; reason = ''">Anular</button>
            </div>
            <div v-if="cancelling === o.id" class="space-y-2">
              <label :for="`reason-${o.id}`" class="block">Motivo de la anulación</label>
              <input :id="`reason-${o.id}`" v-model="reason" type="text" maxlength="200" :class="input" />
              <button type="button" :disabled="busy" :class="btn" @click="cancel(o)">Confirmar anulación</button>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </template>
</template>

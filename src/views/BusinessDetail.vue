<script setup>
import { ref, reactive, onMounted } from 'vue'
import { listBusinesses, updateBusiness, listBillingPayments, recordBillingPayment, setBusinessBlocked } from '../services/businesses.js'
import { addMonths } from '../domain/billing.js'
import { parsePesos, formatCOP } from '../domain/money.js'
import { errorText } from './messages.js'

const props = defineProps({ businessId: { type: String, required: true } })
const emit = defineEmits(['changed'])

const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const input = `min-h-11 w-full rounded border border-slate-400 px-3 ${focus}`
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white motion-reduce:transition-none ${focus}`
const hours = Array.from({ length: 24 }, (_, i) => i)

const biz = ref(null)
const f = reactive({ name: '', motorcycle: false, car: false, fee: '', shifts: [] })
const payments = ref([])
const pay = reactive({ amount: '', periodMonth: '', method: 'Transferencia', note: '', paidUntil: '' })
const reason = ref('')
const error = ref('')
const success = ref('')
const busy = ref(false)
let rowKey = 0

async function load() {
  biz.value = (await listBusinesses()).businesses.find((b) => b.id === props.businessId)
  const b = biz.value
  Object.assign(f, {
    name: b.name, motorcycle: b.enabledVehicleTypes.includes('motorcycle'), car: b.enabledVehicleTypes.includes('car'),
    fee: String(b.billing.monthlyFee), shifts: b.shifts.map((s) => ({ ...s, key: rowKey++ })),
  })
  payments.value = await listBillingPayments(b.id)
  pay.paidUntil = addMonths(b.billing.paidUntil, 1) // PD-6
  pay.periodMonth = pay.paidUntil.slice(0, 7)
}
async function run(fn, ok, overrides) {
  error.value = ''; success.value = ''
  busy.value = true
  try { await fn(); success.value = ok; await load(); emit('changed'); return true } catch (e) { error.value = errorText(e, overrides); return false } finally { busy.value = false }
}
// Each form sends only its own fields; the mock needs the full set, so the rest comes from the saved values.
async function saveData() {
  const enabledVehicleTypes = [f.motorcycle && 'motorcycle', f.car && 'car'].filter(Boolean)
  await run(() => updateBusiness(props.businessId, { name: f.name, enabledVehicleTypes, monthlyFee: parsePesos(f.fee), shifts: biz.value.shifts }), 'Datos guardados.',
    { validation: 'Revisá nombre, al menos un tipo y la mensualidad en pesos.' })
}
async function saveShifts() {
  if (f.shifts.some((s) => !s.name.trim())) { success.value = ''; error.value = 'Escribí el nombre de cada turno.'; return }
  const shifts = f.shifts.map(({ id, name, startHour, endHour }) => ({ id, name, startHour: Number(startHour), endHour: Number(endHour) }))
  await run(() => updateBusiness(props.businessId, { name: biz.value.name, enabledVehicleTypes: biz.value.enabledVehicleTypes, monthlyFee: biz.value.billing.monthlyFee, shifts }), 'Turnos guardados.',
    { validation: 'Los turnos deben cubrir las 24 horas sin huecos ni cruces.' })
}
const addRow = () => f.shifts.push({ id: null, name: '', startHour: 0, endHour: 0, key: rowKey++ })
const removeRow = (i) => f.shifts.splice(i, 1)
// same rule as WasherPay: a retried payment replays, never doubles
const payId = ref(crypto.randomUUID())
async function register() {
  await run(() => recordBillingPayment(props.businessId, { id: payId.value, amount: parsePesos(pay.amount), periodMonth: pay.periodMonth, method: pay.method, note: pay.note, paidUntil: pay.paidUntil }), 'Pago registrado.',
    { validation: 'Revisá el valor en pesos, el mes, el medio y la fecha.' })
  if (!error.value) { pay.amount = ''; pay.note = ''; payId.value = crypto.randomUUID() }
}
const block = (blocked) => run(() => setBusinessBlocked(props.businessId, { blocked, reason: reason.value }), blocked ? 'Negocio bloqueado.' : 'Negocio desbloqueado.',
  { validation: 'Escribí el motivo (1 a 200 caracteres).' })

onMounted(async () => { try { await load() } catch (e) { error.value = errorText(e) } })
</script>

<template>
  <section v-if="biz" class="mb-6 space-y-6 rounded border border-slate-300 p-3" aria-labelledby="bd-h">
    <h2 id="bd-h" class="text-lg font-bold">{{ biz.name }}</h2>
    <p v-if="error" role="alert" class="rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
    <p v-if="success" role="status" class="rounded bg-green-100 p-3 text-green-900">{{ success }}</p>

    <form class="space-y-3" @submit.prevent="saveData">
      <div><label for="bd-n" class="block font-bold">Nombre</label><input id="bd-n" v-model="f.name" type="text" maxlength="60" :class="input" /></div>
      <fieldset>
        <legend class="font-bold">Tipos habilitados</legend>
        <label class="mr-4 inline-flex min-h-11 items-center gap-2"><input v-model="f.motorcycle" type="checkbox" class="size-5" /> Moto</label>
        <label class="inline-flex min-h-11 items-center gap-2"><input v-model="f.car" type="checkbox" class="size-5" /> Carro</label>
      </fieldset>
      <div><label for="bd-f" class="block font-bold">Mensualidad (pesos)</label><input id="bd-f" v-model="f.fee" type="text" inputmode="numeric" autocomplete="off" :class="input" /></div>
      <button type="submit" :disabled="busy" :class="btn">Guardar datos</button>
    </form>

    <form class="space-y-3" aria-labelledby="sh-h" @submit.prevent="saveShifts">
      <h3 id="sh-h" class="font-bold">Turnos</h3>
      <div v-for="(s, i) in f.shifts" :key="s.key" class="space-y-2 rounded border border-slate-200 p-2">
        <div><label :for="`sh-n-${s.key}`" class="block">Nombre del turno</label><input :id="`sh-n-${s.key}`" v-model="s.name" type="text" maxlength="40" :class="input" /></div>
        <div class="flex gap-2">
          <div class="flex-1"><label :for="`sh-s-${s.key}`" class="block">Hora de inicio</label>
            <select :id="`sh-s-${s.key}`" v-model="s.startHour" :class="input"><option v-for="h in hours" :key="h" :value="h">{{ h }}</option></select></div>
          <div class="flex-1"><label :for="`sh-e-${s.key}`" class="block">Hora de fin</label>
            <select :id="`sh-e-${s.key}`" v-model="s.endHour" :class="input"><option v-for="h in hours" :key="h" :value="h">{{ h }}</option></select></div>
        </div>
        <button type="button" class="min-h-11 rounded border border-slate-400 px-4" :class="focus" @click="removeRow(i)">Quitar turno</button>
      </div>
      <div class="flex gap-2">
        <button type="button" class="min-h-11 rounded border border-slate-400 px-4" :class="focus" @click="addRow">Agregar turno</button>
        <button type="submit" :disabled="busy" :class="btn">Guardar turnos</button>
      </div>
    </form>

    <section aria-labelledby="pg-h">
      <h3 id="pg-h" class="mb-2 font-bold">Pagos</h3>
      <p v-if="!payments.length">Sin pagos registrados.</p>
      <ul class="mb-3 space-y-2">
        <li v-for="(p, i) in payments" :key="i" class="rounded border border-slate-200 p-2">
          <span class="block font-bold">{{ formatCOP(p.amount) }} — {{ p.periodMonth }}</span>
          <span class="block">{{ p.method }}, pagado hasta {{ p.paidUntil }}<template v-if="p.note"> — {{ p.note }}</template></span>
        </li>
      </ul>
      <form class="space-y-3" @submit.prevent="register">
        <h4 class="font-bold">Registrar pago</h4>
        <div><label for="pg-a" class="block">Valor (pesos)</label><input id="pg-a" v-model="pay.amount" type="text" inputmode="numeric" autocomplete="off" :class="input" /></div>
        <div><label for="pg-m" class="block">Mes que paga</label><input id="pg-m" v-model="pay.periodMonth" type="month" :class="input" /></div>
        <div><label for="pg-t" class="block">Medio de pago</label><input id="pg-t" v-model="pay.method" type="text" maxlength="30" :class="input" /></div>
        <div><label for="pg-o" class="block">Nota (opcional)</label><input id="pg-o" v-model="pay.note" type="text" maxlength="200" :class="input" /></div>
        <div><label for="pg-u" class="block">Pagado hasta</label><input id="pg-u" v-model="pay.paidUntil" type="date" :class="input" /></div>
        <button type="submit" :disabled="busy" :class="btn">Registrar pago</button>
      </form>
    </section>

    <section aria-labelledby="bl-h">
      <h3 id="bl-h" class="mb-2 font-bold">Acceso</h3>
      <p v-if="biz.status === 'blocked'" class="mb-2">Bloqueado: {{ biz.blockedReason }}</p>
      <template v-if="biz.status === 'blocked'">
        <button type="button" :class="btn" @click="block(false)">Desbloquear</button>
      </template>
      <template v-else>
        <label for="bl-r" class="block">Motivo del bloqueo</label>
        <input id="bl-r" v-model="reason" type="text" maxlength="200" :class="`${input} mb-2`" />
        <button type="button" :class="btn" @click="block(true)">Bloquear</button>
      </template>
    </section>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { listBusinesses, createBusiness, setAlertWindowDays } from '../services/businesses.js'
import { parsePesos } from '../domain/money.js'
import { errorText } from './messages.js'
import BusinessDetail from './BusinessDetail.vue'

const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const input = `min-h-11 w-full rounded border border-slate-400 px-3 ${focus}`
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white motion-reduce:transition-none ${focus}`
const card = `block min-h-11 w-full rounded border border-slate-300 p-3 text-left motion-reduce:transition-none ${focus}`

const data = ref({ businesses: [], alerts: { overdue: [], expiring: [] }, alertWindowDays: 5 })
const selectedId = ref('')
const error = ref('')
const success = ref('')
const days = ref('5')
const busy = ref(false)
const blank = () => ({ name: '', motorcycle: true, car: false, fee: '', paidUntil: '', adminName: '', adminEmail: '', adminPassword: '' })
const form = ref(blank())

const pick = (ids) => ids.map((id) => data.value.businesses.find((b) => b.id === id)).filter(Boolean)
const overdue = computed(() => pick(data.value.alerts.overdue))
const expiring = computed(() => pick(data.value.alerts.expiring))
const isOverdue = (b) => data.value.alerts.overdue.includes(b.id)

async function load() {
  data.value = await listBusinesses()
  days.value = String(data.value.alertWindowDays)
}
async function run(fn, ok, overrides = { validation: 'Revisá los datos: nombre, al menos un tipo, valor en pesos, fecha, un correo válido y una contraseña de al menos 8 caracteres.' }) {
  error.value = ''; success.value = ''
  busy.value = true
  try { await fn(); success.value = ok; return true } catch (e) { error.value = errorText(e, overrides); return false } finally { busy.value = false }
}
async function changeDays() {
  const n = Number(days.value)
  await run(async () => { await setAlertWindowDays(n); await load() }, `Ventana de aviso: ${n} días.`, { validation: 'Escribí un número de días entre 1 y 60.' })
}
async function create() {
  const f = form.value
  const fee = parsePesos(f.fee)
  const enabledVehicleTypes = [f.motorcycle && 'motorcycle', f.car && 'car'].filter(Boolean)
  if (await run(async () => { await createBusiness({ name: f.name, enabledVehicleTypes, monthlyFee: fee, paidUntil: f.paidUntil, adminName: f.adminName, adminEmail: f.adminEmail, adminPassword: f.adminPassword }); await load() }, 'Negocio creado.')) form.value = blank()
}
onMounted(async () => { try { await load() } catch (e) { error.value = errorText(e) } })
</script>

<template>
  <h1 class="mb-4 text-xl font-bold">
    Negocios
    <span class="ml-2 rounded-full bg-red-100 px-3 py-1 text-sm text-red-900">{{ overdue.length + expiring.length }}<span class="sr-only"> con alerta de pago</span></span>
  </h1>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
  <p v-if="success" role="status" class="mb-4 rounded bg-green-100 p-3 text-green-900">{{ success }}</p>

  <section class="mb-6" aria-labelledby="ov-h">
    <h2 id="ov-h" class="mb-2 text-lg font-bold">Vencidos</h2>
    <p v-if="!overdue.length">Ninguno.</p>
    <ul class="space-y-2">
      <li v-for="b in overdue" :key="b.id">
        <button type="button" :class="card" @click="selectedId = b.id"><span class="block font-bold">{{ b.name }}</span><span class="block text-red-800">Pagado hasta {{ b.billing.paidUntil }}</span></button>
      </li>
    </ul>
  </section>

  <section class="mb-6" aria-labelledby="ex-h">
    <h2 id="ex-h" class="mb-2 text-lg font-bold">Por vencer (próximos {{ data.alertWindowDays }} días)</h2>
    <label for="win" class="block font-bold">Días de aviso</label>
    <div class="mb-2 flex gap-2">
      <input id="win" v-model="days" type="number" min="1" max="60" inputmode="numeric" :class="input" />
      <button type="button" :class="btn" @click="changeDays">Cambiar</button>
    </div>
    <p v-if="!expiring.length">Ninguno.</p>
    <ul class="space-y-2">
      <li v-for="b in expiring" :key="b.id">
        <button type="button" :class="card" @click="selectedId = b.id"><span class="block font-bold">{{ b.name }}</span><span class="block">Pagado hasta {{ b.billing.paidUntil }}</span></button>
      </li>
    </ul>
  </section>

  <section class="mb-6" aria-labelledby="all-h">
    <h2 id="all-h" class="mb-2 text-lg font-bold">Todos</h2>
    <ul class="space-y-2">
      <li v-for="b in data.businesses" :key="b.id">
        <button type="button" :aria-pressed="selectedId === b.id" :class="`${card} ${selectedId === b.id ? 'border-blue-700 bg-blue-50' : ''}`" @click="selectedId = b.id">
          <span class="block font-bold">{{ b.name }}</span>
          <span class="block">{{ isOverdue(b) ? 'Vencido' : 'Al día' }}<span v-if="b.status === 'blocked'" class="ml-2 rounded bg-slate-800 px-2 py-0.5 text-sm text-white">Bloqueado</span></span>
        </button>
      </li>
    </ul>
  </section>

  <BusinessDetail v-if="selectedId" :key="selectedId" :business-id="selectedId" @changed="load" />

  <form class="mb-6 space-y-3" aria-labelledby="new-h" @submit.prevent="create">
    <h2 id="new-h" class="text-lg font-bold">Crear negocio</h2>
    <div><label for="nb-n" class="block font-bold">Nombre</label><input id="nb-n" v-model="form.name" type="text" maxlength="60" :class="input" /></div>
    <fieldset>
      <legend class="font-bold">Tipos habilitados</legend>
      <label class="mr-4 inline-flex min-h-11 items-center gap-2"><input v-model="form.motorcycle" type="checkbox" class="size-5" /> Moto</label>
      <label class="inline-flex min-h-11 items-center gap-2"><input v-model="form.car" type="checkbox" class="size-5" /> Carro</label>
    </fieldset>
    <div><label for="nb-f" class="block font-bold">Mensualidad (pesos)</label><input id="nb-f" v-model="form.fee" type="text" inputmode="numeric" autocomplete="off" :class="input" /></div>
    <div><label for="nb-p" class="block font-bold">Pagado hasta</label><input id="nb-p" v-model="form.paidUntil" type="date" :class="input" /></div>
    <div><label for="nb-a" class="block font-bold">Nombre del administrador</label><input id="nb-a" v-model="form.adminName" type="text" maxlength="60" :class="input" /></div>
    <div><label for="nb-e" class="block font-bold">Correo del administrador</label><input id="nb-e" v-model="form.adminEmail" type="email" autocomplete="off" :class="input" /></div>
    <div><label for="nb-w" class="block font-bold">Contraseña</label><input id="nb-w" v-model="form.adminPassword" type="password" autocomplete="new-password" aria-describedby="nb-w-h" :class="input" /><p id="nb-w-h" class="text-sm">Mínimo 8 caracteres.</p></div>
    <button type="submit" :disabled="busy" :class="btn">Crear negocio</button>
  </form>
</template>

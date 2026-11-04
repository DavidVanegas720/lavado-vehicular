<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { listCatalog } from '../services/catalog.js'
import { createOrder } from '../services/orders.js'
import { getShiftStatus, openShift } from '../services/shifts.js'
import { formatCOP, parsePesos } from '../domain/money.js'
import { formatPercent, commissionAmount } from '../domain/commission.js'
import { parsePlate } from '../domain/plate.js'
import { suggestCategory } from '../domain/displacement.js'
import { errorText } from './messages.js'
import { getSession } from '../services/session.js'

const input = 'min-h-11 w-full rounded border border-slate-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const row = 'flex min-h-11 items-center gap-2'
const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white hover:bg-blue-800 disabled:opacity-50 motion-reduce:transition-none ${focus}`

const status = ref(null)
const types = ref(['motorcycle'])
const vehicleType = ref('motorcycle')
const isCar = computed(() => vehicleType.value === 'car')
const cat = ref({ categories: [], washTypes: [], washers: [], prices: [] })
const baseText = ref('')
const plate = ref('')
const special = ref(false)
const ccText = ref('')
const categoryId = ref('')
const washTypeId = ref('')
const washerId = ref('')
const courtesy = ref(false)
const reason = ref('')
const error = ref('')
const success = ref('')
const busy = ref(false)
const formId = ref(crypto.randomUUID()) // one id per intended wash: a retry after a lost reply replays, not doubles

const fail = (e) => { error.value = errorText(e, { not_found: 'El catálogo cambió. Revisá la selección.' }) }

async function load() {
  status.value = await getShiftStatus()
  types.value = (await getSession())?.enabledVehicleTypes ?? ['motorcycle']
  if (!types.value.includes(vehicleType.value)) vehicleType.value = types.value[0]
  cat.value = await listCatalog()
  // clear selections that no longer exist after a catalog reload
  const has = (list, id) => list.some((x) => x.id === id)
  if (!has(cat.value.categories, categoryId.value)) categoryId.value = ''
  if (!has(cat.value.washTypes, washTypeId.value)) washTypeId.value = ''
  if (!has(cat.value.washers, washerId.value)) washerId.value = ''
}
onMounted(async () => { try { await load() } catch (e) { fail(e) } })

const cats = computed(() => cat.value.categories.filter((c) => c.vehicleType === vehicleType.value))
const washTypes = computed(() => cat.value.washTypes.filter((t) => t.vehicleType === vehicleType.value))
watch(vehicleType, () => { categoryId.value = ''; washTypeId.value = ''; ccText.value = '' })

const cc = computed(() => (/^\d+$/.test(ccText.value.trim()) ? Number(ccText.value) : null))
const suggested = computed(() => (cc.value ? suggestCategory(cc.value, cats.value) : null))
watch(suggested, (s) => { if (s) categoryId.value = s.id })

const priceOf = (typeId) => cat.value.prices.find((p) => p.categoryId === categoryId.value && p.washTypeId === typeId)?.price
const listPrice = computed(() => priceOf(washTypeId.value))
const washer = computed(() => cat.value.washers.find((w) => w.id === washerId.value))
const noPrice = computed(() => categoryId.value && washTypeId.value && listPrice.value === undefined)

async function open() {
  error.value = ''
  const openingCash = parsePesos(baseText.value)
  if (openingCash === null) { error.value = 'Escribí la base en pesos, sin decimales.'; return }
  busy.value = true
  try { await openShift({ openingCash }) } catch (e) { error.value = errorText(e, { invalid_state: 'El turno ya lo abrió otro operador.' }) } finally { busy.value = false }
  try { await load() } catch (e) { fail(e) }
}

async function save() {
  error.value = ''
  success.value = ''
  const p = parsePlate(plate.value, vehicleType.value, special.value)
  if (!p) { error.value = `Formato no válido. Ejemplo: ${isCar.value ? 'ABC123' : 'ABC12D'}.`; return }
  if (!isCar.value && !cc.value) { error.value = 'Escribí el cilindraje en números.'; return }
  if (!isCar.value && !suggested.value) { error.value = 'Ninguna categoría cubre ese cilindraje.'; return }
  if (!isCar.value && categoryId.value !== suggested.value.id) { error.value = 'Esa categoría no cubre ese cilindraje.'; return }
  if (!categoryId.value || !washTypeId.value || !washerId.value) { error.value = 'Elegí categoría, tipo de lavado y lavador.'; return }
  if (noPrice.value) { error.value = 'Este lavado no tiene precio. Avisale al administrador.'; return }
  if (courtesy.value && (reason.value.trim().length < 1 || reason.value.trim().length > 200)) {
    error.value = 'Escribí el motivo de la cortesía.'
    return
  }
  busy.value = true
  try {
    const o = await createOrder({
      id: formId.value, plate: plate.value, plateSpecial: special.value, vehicleType: vehicleType.value, cc: isCar.value ? undefined : cc.value, categoryId: categoryId.value,
      washTypeId: washTypeId.value, washerId: washerId.value, isCourtesy: courtesy.value,
      courtesyReason: courtesy.value ? reason.value : undefined,
    })
    success.value = `Lavada registrada: placa ${o.plate}, cobro ${formatCOP(o.finalPrice)}, comisión ${formatCOP(o.commissionAmount)}.`
    plate.value = ''; special.value = false; ccText.value = ''; courtesy.value = false; reason.value = ''
    formId.value = crypto.randomUUID()
  } catch (e) {
    fail(e)
    if (e.code === 'not_found' || e.code === 'shift_not_open') await load()
  } finally { busy.value = false }
}
</script>

<template>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
  <p v-if="success" role="status" class="mb-4 rounded bg-green-100 p-3 text-green-900">
    {{ success }} <RouterLink to="/my-orders" class="underline">Ver mis órdenes del turno</RouterLink>
  </p>
  <p v-if="status?.unclosed.length" role="status" class="mb-4 rounded bg-yellow-100 p-3">
    Hay un turno sin cerrar: {{ status.unclosed[0].shiftName }}. Se cierra en <RouterLink to="/shift-close" class="underline">Cierre de turno</RouterLink>.
  </p>

  <form v-if="status?.current.state === 'not_opened'" class="space-y-4" @submit.prevent="open">
    <h1 class="text-xl font-bold">Abrir {{ status.current.shiftName }}</h1>
    <div>
      <label for="base" class="block">Base de caja</label>
      <input id="base" v-model="baseText" type="text" inputmode="numeric" autocomplete="off" :class="input" />
    </div>
    <button type="submit" :disabled="busy" :class="btn">Abrir turno</button>
  </form>

  <form v-else-if="status" class="space-y-4" @submit.prevent="save">
    <h1 class="text-xl font-bold">Nueva lavada</h1>
    <fieldset v-if="types.length > 1">
      <legend>Tipo de vehículo</legend>
      <label :class="row"><input v-model="vehicleType" type="radio" name="vehicleType" value="motorcycle" class="size-5" /> Moto</label>
      <label :class="row"><input v-model="vehicleType" type="radio" name="vehicleType" value="car" class="size-5" /> Carro</label>
    </fieldset>
    <div>
      <label for="plate" class="block">Placa</label>
      <input id="plate" v-model="plate" type="text" autocapitalize="characters" autocomplete="off" :class="input" />
      <label :class="row"><input v-model="special" type="checkbox" class="size-5" /> Placa especial</label>
    </div>
    <div v-if="!isCar">
      <label for="cc" class="block">Cilindraje (cc)</label>
      <input id="cc" v-model="ccText" type="text" inputmode="numeric" autocomplete="off" :class="input" />
    </div>
    <fieldset>
      <legend>Categoría</legend>
      <label v-for="c in cats" :key="c.id" :class="row">
        <input v-model="categoryId" type="radio" name="category" :value="c.id" class="size-5" />
        {{ c.name }}<span v-if="c.id === suggested?.id"> (sugerida)</span>
      </label>
    </fieldset>
    <fieldset>
      <legend>Tipo de lavado</legend>
      <label v-for="t in washTypes" :key="t.id" :class="row">
        <input v-model="washTypeId" type="radio" name="washType" :value="t.id" class="size-5" />
        {{ t.name }} — {{ priceOf(t.id) === undefined ? 'sin precio' : formatCOP(priceOf(t.id)) }}
      </label>
    </fieldset>
    <div>
      <label for="washer" class="block">Lavador</label>
      <select id="washer" v-model="washerId" :class="input">
        <option value="" disabled>Elegí un lavador</option>
        <option v-for="w in cat.washers" :key="w.id" :value="w.id">{{ w.name }}</option>
      </select>
    </div>
    <p v-if="washer && listPrice !== undefined">
      {{ washer.name }} recibe {{ formatCOP(commissionAmount(listPrice, washer.commissionBp)) }}
      ({{ formatPercent(washer.commissionBp) }} del precio de lista)
    </p>
    <div>
      <label :class="row"><input v-model="courtesy" type="checkbox" class="size-5" /> Es cortesía</label>
      <template v-if="courtesy">
        <label for="reason" class="block">Motivo de la cortesía</label>
        <input id="reason" v-model="reason" type="text" maxlength="200" :class="input" />
      </template>
    </div>
    <button type="submit" :disabled="!!noPrice || busy" :class="btn">Guardar</button>
  </form>
</template>

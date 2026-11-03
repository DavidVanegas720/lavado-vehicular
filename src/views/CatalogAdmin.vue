<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  listCategories, listWashTypes, listPrices,
  createCategory, updateCategory, setCategoryActive,
  createWashType, updateWashType, setWashTypeActive, setPrice,
} from '../services/catalog.js'
import { formatCOP, parsePesos } from '../domain/money.js'
import { errorText } from './messages.js'
import { getSession } from '../services/session.js'

const input = 'min-h-11 w-full rounded border border-slate-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white hover:bg-blue-800 disabled:opacity-50 motion-reduce:transition-none ${focus}`
const btn2 = `min-h-11 rounded border border-slate-400 px-4 hover:bg-slate-100 motion-reduce:transition-none ${focus}`
const card = 'rounded border border-slate-300 p-3 space-y-2'

const cats = ref([])
const types = ref([])
const prices = ref([])
const error = ref('')
const success = ref('')
const priceText = reactive({}) // `${categoryId}|${washTypeId}` -> typed text
const both = ref(false)
const newCat = reactive({ vehicleType: 'motorcycle', name: '', minCc: '', maxCc: '', prices: {} })
const newType = reactive({ vehicleType: 'motorcycle', name: '', prices: {} })
const editCat = ref(null) // { id, name, minCc, maxCc }
const editType = ref(null) // { id, name }

const key = (c, t) => `${c}|${t}`
const priceOf = (c, t) => prices.value.find((p) => p.categoryId === c && p.washTypeId === t)?.price
const state = (x, wt) => (x.active ? (wt ? 'Activo' : 'Activa') : (wt ? 'Inactivo' : 'Inactiva'))
const msgs = { validation: 'Revisá los datos: nombre de 1 a 60 letras y, en motos, cilindraje mínimo menor o igual al máximo.' }
const intOrNaN = (t) => (/^\d+$/.test(t.trim()) ? Number(t) : NaN)

function load() {
  const enabled = getSession()?.enabledVehicleTypes ?? ['motorcycle']
  both.value = enabled.length > 1
  for (const x of [newCat, newType]) if (!enabled.includes(x.vehicleType)) x.vehicleType = enabled[0]
  cats.value = listCategories()
  types.value = listWashTypes()
  prices.value = listPrices()
  for (const c of cats.value) for (const t of types.value) {
    const p = priceOf(c.id, t.id)
    priceText[key(c.id, t.id)] ??= p === undefined ? '' : formatCOP(p)
  }
}

// Runs an action: clears messages, reloads on success, shows errorText on failure. Returns true on success.
function run(fn, ok) {
  error.value = ''
  success.value = ''
  try { fn(); load(); success.value = ok; return true } catch (e) {
    error.value = errorText(e, msgs)
    if (e.code === 'not_found') try { load() } catch { /* shown above */ }
    return false
  }
}

// Every price field must parse; blank or invalid -> message, nothing sent.
function parsePrices(map, others) {
  const out = {}
  for (const o of others) {
    const v = parsePesos(map[o.id] ?? '')
    if (!v) { error.value = `Escribí el precio de ${o.name} en pesos, sin decimales.`; return null }
    out[o.id] = v
  }
  return out
}

function addCategory() {
  error.value = ''
  success.value = ''
  const car = newCat.vehicleType === 'car'
  const minCc = intOrNaN(newCat.minCc)
  const maxCc = intOrNaN(newCat.maxCc)
  if (!car && (Number.isNaN(minCc) || Number.isNaN(maxCc))) { error.value = 'Escribí el cilindraje mínimo y máximo en números.'; return }
  const p = parsePrices(newCat.prices, types.value.filter((t) => t.active && t.vehicleType === newCat.vehicleType))
  if (!p) return
  if (run(() => createCategory({ vehicleType: newCat.vehicleType, name: newCat.name, ...(car ? {} : { minCc, maxCc }), prices: p }), 'Categoría creada.')) {
    Object.assign(newCat, { name: '', minCc: '', maxCc: '', prices: {} })
  }
}

function saveCategory() {
  error.value = ''
  success.value = ''
  const e = editCat.value
  const minCc = intOrNaN(e.minCc)
  const maxCc = intOrNaN(e.maxCc)
  if (e.vehicleType !== 'car' && (Number.isNaN(minCc) || Number.isNaN(maxCc))) { error.value = 'Escribí el cilindraje mínimo y máximo en números.'; return }
  if (run(() => updateCategory(e.id, { name: e.name, minCc, maxCc }), 'Categoría guardada.')) editCat.value = null
}

function addType() {
  error.value = ''
  success.value = ''
  const p = parsePrices(newType.prices, cats.value.filter((c) => c.active && c.vehicleType === newType.vehicleType))
  if (!p) return
  if (run(() => createWashType({ vehicleType: newType.vehicleType, name: newType.name, prices: p }), 'Tipo de lavado creado.')) {
    Object.assign(newType, { name: '', prices: {} })
  }
}

function saveType() {
  const e = editType.value
  if (run(() => updateWashType(e.id, { name: e.name }), 'Tipo de lavado guardado.')) editType.value = null
}

function savePrice(c, t) {
  const v = parsePesos(priceText[key(c.id, t.id)])
  if (!v) { success.value = ''; error.value = `Escribí el precio de ${t.name} en pesos, sin decimales.`; return }
  if (run(() => setPrice(c.id, t.id, v), `Precio guardado: ${c.name}, ${t.name}, ${formatCOP(v)}.`)) priceText[key(c.id, t.id)] = formatCOP(v)
}

onMounted(() => { try { load() } catch (e) { error.value = errorText(e) } })
</script>

<template>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
  <p v-if="success" role="status" class="mb-4 rounded bg-green-100 p-3 text-green-900">{{ success }}</p>

  <h1 class="mb-4 text-xl font-bold">Catálogo</h1>

  <section aria-labelledby="h-cats" class="mb-8 space-y-3">
    <h2 id="h-cats" class="text-lg font-bold">Categorías</h2>
    <ul class="space-y-3">
      <li v-for="c in cats" :key="c.id" :class="card">
        <form v-if="editCat?.id === c.id" class="space-y-2" @submit.prevent="saveCategory">
          <label :for="`ec-n-${c.id}`" class="block">Nombre</label>
          <input :id="`ec-n-${c.id}`" v-model="editCat.name" type="text" maxlength="60" :class="input" />
          <template v-if="c.vehicleType !== 'car'">
            <label :for="`ec-a-${c.id}`" class="block">Cilindraje mínimo (cc)</label>
            <input :id="`ec-a-${c.id}`" v-model="editCat.minCc" type="text" inputmode="numeric" autocomplete="off" :class="input" />
            <label :for="`ec-b-${c.id}`" class="block">Cilindraje máximo (cc)</label>
            <input :id="`ec-b-${c.id}`" v-model="editCat.maxCc" type="text" inputmode="numeric" autocomplete="off" :class="input" />
          </template>
          <div class="flex flex-wrap gap-2">
            <button type="submit" :class="btn">Guardar</button>
            <button type="button" :class="btn2" @click="editCat = null">Cancelar</button>
          </div>
        </form>
        <template v-else>
          <p class="font-bold">{{ c.name }} <span class="font-normal">({{ state(c) }})</span></p>
          <p v-if="c.vehicleType === 'car'">Carro</p>
          <p v-else>{{ c.minCc }} a {{ c.maxCc }} cc</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" :class="btn2" @click="editCat = { id: c.id, vehicleType: c.vehicleType, name: c.name, minCc: String(c.minCc ?? ''), maxCc: String(c.maxCc ?? '') }">Editar<span class="sr-only"> {{ c.name }}</span></button>
            <button type="button" :class="btn2" @click="run(() => setCategoryActive(c.id, !c.active), c.active ? 'Categoría desactivada.' : 'Categoría reactivada.')">
              {{ c.active ? 'Desactivar' : 'Reactivar' }}<span class="sr-only"> {{ c.name }}</span>
            </button>
          </div>
        </template>
      </li>
    </ul>

    <form :class="card" @submit.prevent="addCategory">
      <h3 class="font-bold">Nueva categoría</h3>
      <fieldset v-if="both">
        <legend>Tipo de vehículo</legend>
        <label class="mr-4 inline-flex min-h-11 items-center gap-2"><input v-model="newCat.vehicleType" type="radio" name="nc-vt" value="motorcycle" class="size-5" /> Moto</label>
        <label class="inline-flex min-h-11 items-center gap-2"><input v-model="newCat.vehicleType" type="radio" name="nc-vt" value="car" class="size-5" /> Carro</label>
      </fieldset>
      <label for="nc-n" class="block">Nombre</label>
      <input id="nc-n" v-model="newCat.name" type="text" maxlength="60" :class="input" />
      <template v-if="newCat.vehicleType !== 'car'">
        <label for="nc-a" class="block">Cilindraje mínimo (cc)</label>
        <input id="nc-a" v-model="newCat.minCc" type="text" inputmode="numeric" autocomplete="off" :class="input" />
        <label for="nc-b" class="block">Cilindraje máximo (cc)</label>
        <input id="nc-b" v-model="newCat.maxCc" type="text" inputmode="numeric" autocomplete="off" :class="input" />
      </template>
      <template v-for="t in types.filter((x) => x.active && x.vehicleType === newCat.vehicleType)" :key="t.id">
        <label :for="`nc-p-${t.id}`" class="block">Precio de {{ t.name }}</label>
        <input :id="`nc-p-${t.id}`" v-model="newCat.prices[t.id]" type="text" inputmode="numeric" autocomplete="off" :class="input" />
      </template>
      <button type="submit" :class="btn">Crear categoría</button>
    </form>
  </section>

  <section aria-labelledby="h-types" class="mb-8 space-y-3">
    <h2 id="h-types" class="text-lg font-bold">Tipos de lavado</h2>
    <ul class="space-y-3">
      <li v-for="t in types" :key="t.id" :class="card">
        <form v-if="editType?.id === t.id" class="space-y-2" @submit.prevent="saveType">
          <label :for="`et-n-${t.id}`" class="block">Nombre</label>
          <input :id="`et-n-${t.id}`" v-model="editType.name" type="text" maxlength="60" :class="input" />
          <div class="flex flex-wrap gap-2">
            <button type="submit" :class="btn">Guardar</button>
            <button type="button" :class="btn2" @click="editType = null">Cancelar</button>
          </div>
        </form>
        <template v-else>
          <p class="font-bold">{{ t.name }}<template v-if="t.vehicleType === 'car'"> · Carro</template> <span class="font-normal">({{ state(t, true) }})</span></p>
          <div class="flex flex-wrap gap-2">
            <button type="button" :class="btn2" @click="editType = { id: t.id, name: t.name }">Editar<span class="sr-only"> {{ t.name }}</span></button>
            <button type="button" :class="btn2" @click="run(() => setWashTypeActive(t.id, !t.active), t.active ? 'Tipo de lavado desactivado.' : 'Tipo de lavado reactivado.')">
              {{ t.active ? 'Desactivar' : 'Reactivar' }}<span class="sr-only"> {{ t.name }}</span>
            </button>
          </div>
        </template>
      </li>
    </ul>

    <form :class="card" @submit.prevent="addType">
      <h3 class="font-bold">Nuevo tipo de lavado</h3>
      <fieldset v-if="both">
        <legend>Tipo de vehículo</legend>
        <label class="mr-4 inline-flex min-h-11 items-center gap-2"><input v-model="newType.vehicleType" type="radio" name="nt-vt" value="motorcycle" class="size-5" /> Moto</label>
        <label class="inline-flex min-h-11 items-center gap-2"><input v-model="newType.vehicleType" type="radio" name="nt-vt" value="car" class="size-5" /> Carro</label>
      </fieldset>
      <label for="nt-n" class="block">Nombre</label>
      <input id="nt-n" v-model="newType.name" type="text" maxlength="60" :class="input" />
      <template v-for="c in cats.filter((x) => x.active && x.vehicleType === newType.vehicleType)" :key="c.id">
        <label :for="`nt-p-${c.id}`" class="block">Precio en {{ c.name }}</label>
        <input :id="`nt-p-${c.id}`" v-model="newType.prices[c.id]" type="text" inputmode="numeric" autocomplete="off" :class="input" />
      </template>
      <button type="submit" :class="btn">Crear tipo de lavado</button>
    </form>
  </section>

  <section aria-labelledby="h-prices" class="space-y-3">
    <h2 id="h-prices" class="text-lg font-bold">Precios</h2>
    <div v-for="c in cats" :key="c.id" :class="card">
      <h3 class="font-bold">{{ c.name }}<template v-if="c.vehicleType === 'car'"> (Carro)</template><template v-else> ({{ c.minCc }} a {{ c.maxCc }} cc)</template></h3>
      <div v-for="t in types.filter((x) => x.vehicleType === c.vehicleType)" :key="t.id" class="flex flex-wrap items-end gap-2">
        <div class="min-w-40 flex-1">
          <label :for="`p-${c.id}-${t.id}`" class="block">{{ t.name }}<span v-if="!t.active"> (inactivo)</span></label>
          <input :id="`p-${c.id}-${t.id}`" v-model="priceText[key(c.id, t.id)]" type="text" inputmode="numeric" autocomplete="off" :class="input" />
        </div>
        <button type="button" :class="btn2" @click="savePrice(c, t)">Guardar precio<span class="sr-only">: {{ c.name }}, {{ t.name }}</span></button>
      </div>
    </div>
  </section>
</template>

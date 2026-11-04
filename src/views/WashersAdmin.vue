<script setup>
import { ref, reactive, onMounted } from 'vue'
import { listWashers, createWasher, updateWasher, setWasherActive } from '../services/catalog.js'
import { formatPercent, parsePercent } from '../domain/commission.js'
import { PAY_FREQUENCIES } from '../domain/catalog.js'
import { errorText } from './messages.js'

const input = 'min-h-11 w-full rounded border border-slate-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white hover:bg-blue-800 disabled:opacity-50 motion-reduce:transition-none ${focus}`
const btn2 = `min-h-11 rounded border border-slate-400 px-4 hover:bg-slate-100 motion-reduce:transition-none ${focus}`
const card = 'rounded border border-slate-300 p-3 space-y-2'
const radio = 'flex min-h-11 items-center gap-2'
const msgs = { validation: 'Revisá los datos: nombre de 1 a 60 letras y porcentaje de 0 a 100 (ej. 40,5).' }

const washers = ref([])
const error = ref('')
const success = ref('')
const newW = reactive({ name: '', percent: '', payFrequency: 'biweekly' })
const edit = ref(null) // { id, name, percent, payFrequency }
const history = ref(null) // washer id whose history is open
const busy = ref(false)

const when = (d) => new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota' })

async function load() { washers.value = await listWashers() }

// Runs an action: clears messages, reloads on success, shows errorText on failure. Returns true on success.
async function run(fn, ok) {
  error.value = ''
  success.value = ''
  busy.value = true
  try { await fn(); await load(); success.value = ok; return true } catch (e) {
    error.value = errorText(e, msgs)
    if (e.code === 'not_found') try { await load() } catch { /* shown above */ }
    return false
  } finally { busy.value = false }
}

function bpOrError(text) {
  const bp = parsePercent(text)
  if (bp === null) { success.value = ''; error.value = 'Escribí el porcentaje de 0 a 100, con coma y hasta dos decimales (ej. 40,5).' }
  return bp
}

async function add() {
  error.value = ''
  success.value = ''
  const bp = bpOrError(newW.percent)
  if (bp === null) return
  if (await run(() => createWasher({ name: newW.name, commissionBp: bp, payFrequency: newW.payFrequency }), 'Lavador creado.')) {
    Object.assign(newW, { name: '', percent: '', payFrequency: 'biweekly' })
  }
}

async function save() {
  const e = edit.value
  error.value = ''
  success.value = ''
  const bp = bpOrError(e.percent)
  if (bp === null) return
  if (await run(() => updateWasher(e.id, { name: e.name, commissionBp: bp, payFrequency: e.payFrequency }), 'Lavador guardado.')) edit.value = null
}

function startEdit(w) {
  edit.value = { id: w.id, name: w.name, percent: formatPercent(w.commissionBp).replace(/\s*%$/, '').trim(), payFrequency: w.payFrequency }
}

onMounted(async () => { try { await load() } catch (e) { error.value = errorText(e) } })
</script>

<template>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
  <p v-if="success" role="status" class="mb-4 rounded bg-green-100 p-3 text-green-900">{{ success }}</p>

  <h1 class="mb-4 text-xl font-bold">Lavadores</h1>

  <ul class="mb-6 space-y-3">
    <li v-for="w in washers" :key="w.id" :class="card">
      <form v-if="edit?.id === w.id" class="space-y-2" @submit.prevent="save">
        <label :for="`ew-n-${w.id}`" class="block">Nombre</label>
        <input :id="`ew-n-${w.id}`" v-model="edit.name" type="text" maxlength="60" :class="input" />
        <label :for="`ew-p-${w.id}`" class="block">Porcentaje</label>
        <input :id="`ew-p-${w.id}`" v-model="edit.percent" type="text" inputmode="decimal" autocomplete="off" :class="input" />
        <fieldset>
          <legend>Frecuencia de pago</legend>
          <label v-for="(label, key) in PAY_FREQUENCIES" :key="key" :class="radio">
            <input v-model="edit.payFrequency" type="radio" :name="`ew-f-${w.id}`" :value="key" class="size-5" />{{ label }}
          </label>
        </fieldset>
        <div class="flex flex-wrap gap-2">
          <button type="submit" :disabled="busy" :class="btn">Guardar</button>
          <button type="button" :class="btn2" @click="edit = null">Cancelar</button>
        </div>
      </form>
      <template v-else>
        <p class="font-bold">{{ w.name }} <span class="font-normal">({{ w.active ? 'Activo' : 'Inactivo' }})</span></p>
        <p>Porcentaje: {{ formatPercent(w.commissionBp) }}</p>
        <p>Pago: {{ PAY_FREQUENCIES[w.payFrequency] }}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" :class="btn2" @click="startEdit(w)">Editar<span class="sr-only"> {{ w.name }}</span></button>
          <button type="button" :class="btn2" @click="run(() => setWasherActive(w.id, !w.active), w.active ? 'Lavador desactivado.' : 'Lavador reactivado.')">
            {{ w.active ? 'Desactivar' : 'Reactivar' }}<span class="sr-only"> {{ w.name }}</span>
          </button>
          <button type="button" :class="btn2" :aria-expanded="history === w.id" @click="history = history === w.id ? null : w.id">
            Ver historial<span class="sr-only"> de {{ w.name }}</span>
          </button>
        </div>
        <div v-if="history === w.id" class="space-y-2">
          <h3 class="font-bold">Porcentaje</h3>
          <p v-if="!w.commissionHistory.length">Sin cambios.</p>
          <ul v-else class="space-y-1">
            <li v-for="(r, i) in w.commissionHistory" :key="i">{{ formatPercent(r.commissionBp) }} desde {{ when(r.effectiveFrom) }}</li>
          </ul>
          <h3 class="font-bold">Frecuencia de pago</h3>
          <p v-if="!w.payFrequencyHistory.length">Sin cambios.</p>
          <ul v-else class="space-y-1">
            <li v-for="(r, i) in w.payFrequencyHistory" :key="i">{{ PAY_FREQUENCIES[r.payFrequency] }} desde {{ when(r.effectiveFrom) }}</li>
          </ul>
        </div>
      </template>
    </li>
  </ul>

  <form :class="card" @submit.prevent="add">
    <h2 class="font-bold">Nuevo lavador</h2>
    <label for="nw-n" class="block">Nombre</label>
    <input id="nw-n" v-model="newW.name" type="text" maxlength="60" :class="input" />
    <label for="nw-p" class="block">Porcentaje</label>
    <input id="nw-p" v-model="newW.percent" type="text" inputmode="decimal" autocomplete="off" :class="input" />
    <fieldset>
      <legend>Frecuencia de pago</legend>
      <label v-for="(label, key) in PAY_FREQUENCIES" :key="key" :class="radio">
        <input v-model="newW.payFrequency" type="radio" name="nw-f" :value="key" class="size-5" />{{ label }}
      </label>
    </fieldset>
    <button type="submit" :disabled="busy" :class="btn">Crear lavador</button>
  </form>
</template>

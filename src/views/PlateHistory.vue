<script setup>
import { ref } from 'vue'
import { getPlateHistory } from '../services/history.js'
import { formatCOP } from '../domain/money.js'
import { errorText } from './messages.js'

const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const input = `min-h-11 w-full rounded border border-slate-400 px-3 uppercase ${focus}`
const btn = `min-h-11 rounded border border-slate-500 px-4 hover:bg-slate-100 motion-reduce:transition-none ${focus}`
const STATUS = { in_progress: 'En curso', done: 'Terminada', cancelled: 'Anulada' }
const TILES = [['day', 'Hoy'], ['week', 'Semana'], ['month', 'Mes'], ['all', 'Total']]

const plate = ref('')
const result = ref(null)
const error = ref('')
const busy = ref(false)

async function search() {
  error.value = ''
  result.value = null
  busy.value = true
  try { result.value = await getPlateHistory(plate.value) } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
</script>

<template>
  <h1 class="mb-4 text-xl font-bold">Historial por placa</h1>
  <form class="mb-4 flex flex-wrap items-end gap-2" @submit.prevent="search">
    <div class="grow">
      <label for="plate" class="block">Placa</label>
      <input id="plate" v-model="plate" type="text" maxlength="12" autocomplete="off" :class="input" />
    </div>
    <button type="submit" :disabled="busy" :class="btn">Buscar</button>
  </form>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>

  <template v-if="result">
    <ul class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Cantidad de lavadas">
      <li v-for="[key, label] in TILES" :key="key" class="rounded border border-slate-300 p-3 text-center">
        <span class="block text-sm">{{ label }}</span>
        <span class="block text-2xl font-bold">{{ result.counts[key] }}</span>
      </li>
    </ul>
    <p v-if="!result.orders.length">Esta placa no tiene lavadas registradas.</p>
    <ul class="space-y-3">
      <li v-for="o in result.orders" :key="o.id" class="rounded border border-slate-300 p-3">
        <p class="font-bold">
          {{ o.plate }}
          <span v-if="o.plateSpecial" class="rounded bg-slate-200 px-2 text-sm">Especial</span>
        </p>
        <p>{{ STATUS[o.status] }} · {{ o.washerName }}</p>
        <p>{{ new Date(o.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }}</p>
        <p>{{ formatCOP(o.finalPrice) }}</p>
      </li>
    </ul>
  </template>
</template>

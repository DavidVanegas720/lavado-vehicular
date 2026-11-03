<script setup>
import { ref, computed, onMounted } from 'vue'
import { listShiftInstances } from '../services/shifts.js'
import { errorText } from './messages.js'
import ShiftDetail from './ShiftDetail.vue'

const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const card = `block min-h-11 w-full rounded border border-slate-300 p-3 text-left motion-reduce:transition-none ${focus}`

const instances = ref([])
const selectedKey = ref('')
const error = ref('')

const late = computed(() => instances.value.filter((i) => i.lateMs > 0))
const hours = (ms) => Math.floor(ms / 3600000)

onMounted(() => {
  try { instances.value = listShiftInstances() } catch (e) { error.value = errorText(e) }
})
</script>

<template>
  <h1 class="mb-4 text-xl font-bold">Turnos</h1>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>

  <section v-if="late.length" class="mb-6" aria-labelledby="late-h">
    <h2 id="late-h" class="mb-2 text-lg font-bold">Turnos sin cerrar</h2>
    <ul class="space-y-2">
      <li v-for="i in late" :key="i.shiftKey">
        <button type="button" :class="card" @click="selectedKey = i.shiftKey">
          <span class="block font-bold">{{ i.shiftName }}</span>
          <span class="block">{{ i.businessDate }}</span>
          <span class="block text-red-800">{{ i.lateMs >= 3600000 ? `Atrasado ${hours(i.lateMs)} h` : 'Atrasado menos de 1 h' }}</span>
        </button>
      </li>
    </ul>
  </section>

  <section class="mb-6" aria-labelledby="all-h">
    <h2 id="all-h" class="mb-2 text-lg font-bold">Todos los turnos</h2>
    <p v-if="!instances.length">Todavía no hay turnos.</p>
    <ul class="space-y-2">
      <li v-for="i in instances" :key="i.shiftKey">
        <button type="button" :aria-pressed="selectedKey === i.shiftKey" :class="`${card} ${selectedKey === i.shiftKey ? 'border-blue-700 bg-blue-50' : ''}`" @click="selectedKey = i.shiftKey">
          <span class="block font-bold">{{ i.shiftName }}</span>
          <span class="block">{{ i.businessDate }} — {{ i.state === 'closed' ? 'Cerrado' : 'Abierto' }}</span>
        </button>
      </li>
    </ul>
  </section>

  <ShiftDetail v-if="selectedKey" :key="selectedKey" :shift-key="selectedKey" />
</template>

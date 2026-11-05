<script setup>
import { ref, onMounted } from 'vue'
import { listOperators, createOperator, renameOperator, setOperatorActive } from '../services/operators.js'
import { errorText } from './messages.js'

const input = 'min-h-11 w-full rounded border border-slate-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const focus = 'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none'
const btn = `min-h-11 rounded bg-blue-700 px-4 font-bold text-white hover:bg-blue-800 disabled:opacity-50 motion-reduce:transition-none ${focus}`
const btn2 = `min-h-11 rounded border border-slate-400 px-4 hover:bg-slate-100 motion-reduce:transition-none ${focus}`
const card = 'rounded border border-slate-300 p-3 space-y-2'
const msgs = { validation: 'El nombre debe tener entre 1 y 60 letras.' }

const ops = ref([])
const error = ref('')
const success = ref('')
const newName = ref('')
const newEmail = ref('')
const newPassword = ref('')
const edit = ref(null) // { id, name }
const busy = ref(false)

async function load() { ops.value = await listOperators() }

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

async function add() {
  if (await run(() => createOperator({ name: newName.value, email: newEmail.value, password: newPassword.value }), 'Operador creado.')) {
    newName.value = ''
    newEmail.value = ''
    newPassword.value = ''
  }
}

async function save() {
  if (await run(() => renameOperator(edit.value.id, edit.value.name), 'Operador guardado.')) edit.value = null
}

onMounted(async () => { try { await load() } catch (e) { error.value = errorText(e) } })
</script>

<template>
  <p v-if="error" role="alert" class="mb-4 rounded bg-red-100 p-3 text-red-900">{{ error }}</p>
  <p v-if="success" role="status" class="mb-4 rounded bg-green-100 p-3 text-green-900">{{ success }}</p>

  <h1 class="mb-4 text-xl font-bold">Operadores</h1>

  <ul class="mb-6 space-y-3">
    <li v-for="o in ops" :key="o.id" :class="card">
      <form v-if="edit?.id === o.id" class="space-y-2" @submit.prevent="save">
        <label :for="`eo-n-${o.id}`" class="block">Nombre</label>
        <input :id="`eo-n-${o.id}`" v-model="edit.name" type="text" maxlength="60" :class="input" />
        <div class="flex flex-wrap gap-2">
          <button type="submit" :disabled="busy" :class="btn">Guardar</button>
          <button type="button" :class="btn2" @click="edit = null">Cancelar</button>
        </div>
      </form>
      <template v-else>
        <p class="font-bold">{{ o.name }} <span class="font-normal">({{ o.active ? 'Activo' : 'Inactivo' }})</span></p>
        <p v-if="o.email">{{ o.email }}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" :class="btn2" @click="edit = { id: o.id, name: o.name }">Editar<span class="sr-only"> {{ o.name }}</span></button>
          <button type="button" :class="btn2" @click="run(() => setOperatorActive(o.id, !o.active), o.active ? 'Operador desactivado.' : 'Operador reactivado.')">
            {{ o.active ? 'Desactivar' : 'Reactivar' }}<span class="sr-only"> {{ o.name }}</span>
          </button>
        </div>
      </template>
    </li>
  </ul>

  <form :class="card" @submit.prevent="add">
    <h2 class="font-bold">Nuevo operador</h2>
    <label for="no-n" class="block">Nombre</label>
    <input id="no-n" v-model="newName" type="text" maxlength="60" :class="input" />
    <label for="no-e" class="block">Correo</label>
    <input id="no-e" v-model="newEmail" type="email" autocomplete="off" :class="input" />
    <label for="no-p" class="block">Contraseña</label>
    <input id="no-p" v-model="newPassword" type="password" autocomplete="new-password" aria-describedby="no-p-h" :class="input" />
    <p id="no-p-h" class="text-sm">Mínimo 8 caracteres.</p>
    <button type="submit" :disabled="busy" :class="btn">Crear operador</button>
  </form>
</template>

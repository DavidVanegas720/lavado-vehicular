<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useWashesStore } from '../stores/washes.js';
import { normalizePlate, validatePlate } from '../domain/plate.js';
import { categoryForCc } from '../domain/displacement.js';
import { calculateCommission } from '../domain/commission.js';
import { formatCOP } from '../domain/money.js';
import { PAYMENT_METHODS } from '../domain/payment.js';

const MESSAGES = {
  validation: 'Revisá los datos: placa, cilindraje, categoría, tipo de lavado y lavador.',
  category_mismatch: 'El cilindraje no corresponde a la categoría elegida.',
  courtesy_reason_required: 'Escribí el motivo de la cortesía.',
  not_found: 'Algún dato ya no existe en el catálogo. Recargá la página.',
  forbidden: 'No tenés permiso para registrar lavadas.',
  business_blocked: 'La cuenta está suspendida. Contactá a soporte.',
  load_failed: 'No se pudo cargar el catálogo. Recargá la página.',
};

const store = useWashesStore();
const form = reactive({
  plate: '',
  cc: '',
  categoryId: '',
  washTypeId: '',
  washerId: '',
  paymentMethod: 'cash',
  isCourtesy: false,
  courtesyReason: '',
});
const error = ref('');
const saved = ref(null);
const loading = ref(true);
const loadError = ref('');
const busy = ref(false);

onMounted(async () => {
  try {
    await store.load();
  } catch (e) {
    loadError.value = MESSAGES[e.code] ?? MESSAGES.load_failed;
  } finally {
    loading.value = false;
  }
});

const plateError = computed(() =>
  form.plate && !validatePlate(normalizePlate(form.plate), 'motorcycle')
    ? 'Formato no válido. Ejemplo: ABC12D.'
    : '',
);
const suggested = computed(() => categoryForCc(Number(form.cc), store.categories));
// The suggestion is only a default: the operator can pick another category.
watch(suggested, (category) => {
  form.categoryId = category?.id ?? '';
});

const selectedWasher = computed(() => store.washers.find((w) => w.id === form.washerId) ?? null);
const listPrice = computed(() => store.priceOf(form.categoryId, form.washTypeId));
const commission = computed(() =>
  listPrice.value !== null && selectedWasher.value
    ? calculateCommission(listPrice.value, selectedWasher.value.commissionBp)
    : null,
);
const charge = computed(() => (form.isCourtesy ? 0 : listPrice.value));

function resetForm() {
  Object.assign(form, { plate: '', cc: '', categoryId: '', washTypeId: '', isCourtesy: false, courtesyReason: '' });
}

async function submit() {
  error.value = '';
  saved.value = null;
  busy.value = true;
  try {
    saved.value = await store.save({
      plate: form.plate,
      cc: Number(form.cc),
      categoryId: form.categoryId,
      washTypeId: form.washTypeId,
      washerId: form.washerId,
      paymentMethod: form.paymentMethod,
      isCourtesy: form.isCourtesy,
      courtesyReason: form.courtesyReason,
    });
    resetForm();
  } catch (e) {
    error.value = MESSAGES[e.code] ?? 'No se pudo guardar la lavada.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="max-w-xl space-y-6">
    <h1 class="text-xl font-semibold">Nueva lavada</h1>
    <p v-if="loading" class="text-slate-600">Cargando catálogo…</p>

    <p v-else-if="loadError" role="alert" class="text-red-700">{{ loadError }}</p>

    <form v-else class="space-y-6" novalidate @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block space-y-1">
          <span class="font-medium">Placa</span>
          <input
            v-model="form.plate"
            name="plate"
            autocomplete="off"
            autocapitalize="characters"
            :aria-invalid="plateError ? 'true' : 'false'"
            aria-describedby="plate-help"
            class="w-full rounded-md border border-slate-300 px-3 py-2 uppercase"
          />
          <span id="plate-help" class="block text-sm" :class="plateError ? 'text-red-700' : 'text-slate-600'">
            {{ plateError || 'Moto: ABC12D o ABC12.' }}
          </span>
        </label>

        <label class="block space-y-1">
          <span class="font-medium">Cilindraje (cc)</span>
          <input
            v-model="form.cc"
            name="cc"
            type="number"
            inputmode="numeric"
            min="1"
            class="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <fieldset class="space-y-2">
        <legend class="font-medium">Categoría</legend>
        <p v-if="!form.cc" class="text-sm text-slate-600">Escribí el cilindraje para ver la categoría sugerida.</p>
        <p v-else-if="!suggested" class="text-sm text-red-700">Ninguna categoría cubre ese cilindraje.</p>
        <div v-for="category in store.categories" :key="category.id" class="flex items-center gap-2">
          <input :id="`cat-${category.id}`" v-model="form.categoryId" type="radio" name="category" :value="category.id" class="size-5" />
          <label :for="`cat-${category.id}`">
            {{ category.name }}<span v-if="suggested?.id === category.id" class="text-sm text-blue-700"> (sugerida)</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="space-y-2">
        <legend class="font-medium">Tipo de lavado</legend>
        <div v-for="washType in store.washTypes" :key="washType.id" class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-2">
            <input :id="`wt-${washType.id}`" v-model="form.washTypeId" type="radio" name="washType" :value="washType.id" class="size-5" />
            <label :for="`wt-${washType.id}`">{{ washType.name }}</label>
          </span>
          <span v-if="store.priceOf(form.categoryId, washType.id) !== null" class="tabular-nums">
            {{ formatCOP(store.priceOf(form.categoryId, washType.id)) }}
          </span>
        </div>
      </fieldset>

      <label class="block space-y-1">
        <span class="font-medium">Lavador</span>
        <select v-model="form.washerId" name="washer" class="w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="" disabled>Elegí un lavador</option>
          <option v-for="washer in store.washers" :key="washer.id" :value="washer.id">{{ washer.name }}</option>
        </select>
      </label>

      <section aria-label="Vista previa" class="rounded-md bg-slate-50 p-4 space-y-1">
        <p>Cobro: <span class="font-semibold tabular-nums">{{ charge === null ? '—' : formatCOP(charge) }}</span></p>
        <p v-if="selectedWasher && commission !== null">
          {{ selectedWasher.name }} recibe
          <span class="font-semibold tabular-nums">{{ formatCOP(commission) }}</span>
          ({{ selectedWasher.commissionBp / 100 }}% del precio de lista)
        </p>
      </section>

      <fieldset class="space-y-2">
        <legend class="font-medium">Pago</legend>
        <div v-for="(label, method) in PAYMENT_METHODS" :key="method" class="flex items-center gap-2">
          <input :id="`pay-${method}`" v-model="form.paymentMethod" type="radio" name="payment" :value="method" class="size-5" />
          <label :for="`pay-${method}`">{{ label }}</label>
        </div>
      </fieldset>

      <div class="space-y-2">
        <label class="flex items-center gap-2">
          <input v-model="form.isCourtesy" type="checkbox" name="courtesy" class="size-5" />
          <span>Es cortesía</span>
        </label>
        <label v-if="form.isCourtesy" class="block space-y-1">
          <span class="font-medium">Motivo de la cortesía</span>
          <input v-model="form.courtesyReason" name="courtesyReason" class="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
      </div>

      <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
      <!-- The live region stays in the DOM so screen readers announce the text when it changes. -->
      <p role="status" :class="{ 'rounded-md bg-green-50 p-3 text-green-900': saved }">
        <template v-if="saved">
          Lavada guardada: placa {{ saved.plate }}, comisión {{ formatCOP(saved.commissionAmount) }}.
        </template>
      </p>

      <button
        type="submit"
        :disabled="busy"
        class="w-full rounded-md bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Guardar lavada
      </button>
    </form>
  </section>
</template>

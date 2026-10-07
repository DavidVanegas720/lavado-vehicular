<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BotonPeligro from "./BotonPeligro.vue";
import BotonPrincipal from "./BotonPrincipal.vue";
import BotonSecundario from "./BotonSecundario.vue";
import DialogoModal from "./DialogoModal.vue";

const props = withDefaults(
  defineProps<{
    titulo: string;
    mensaje: string;
    etiquetaConfirmar?: string;
    etiquetaCancelar?: string;
    peligroso?: boolean;
    requiereMotivo?: boolean;
    etiquetaMotivo?: string;
    cargando?: boolean;
  }>(),
  { etiquetaConfirmar: "Confirmar", etiquetaCancelar: "Cancelar", etiquetaMotivo: "Motivo" },
);
const visible = defineModel<boolean>("visible", { required: true });
const emit = defineEmits<{ confirmar: [motivo?: string]; cancelar: [] }>();

const motivo = ref("");
const idMotivo = `confirmacion-motivo-${Math.random().toString(36).slice(2, 9)}`;
const sinMotivo = computed(() => props.requiereMotivo && motivo.value.trim() === "");

watch(visible, (abierto) => {
  if (abierto) motivo.value = "";
});

function confirmar(): void {
  if (sinMotivo.value || props.cargando) return;
  emit("confirmar", props.requiereMotivo ? motivo.value.trim() : undefined);
}
function cancelar(): void {
  emit("cancelar");
  visible.value = false;
}
</script>

<template>
  <DialogoModal v-model:visible="visible" :titulo="titulo" ancho="sm" :cerrable="!cargando">
    <p class="text-texto">{{ mensaje }}</p>
    <div v-if="requiereMotivo" class="mt-4 flex flex-col gap-1">
      <label :for="idMotivo" class="font-medium text-texto">{{ etiquetaMotivo }}</label>
      <textarea
        :id="idMotivo"
        v-model="motivo"
        rows="3"
        required
        class="rounded-control border border-borde bg-superficie p-2 text-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario"
      />
    </div>
    <template #pie>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <BotonSecundario
          :etiqueta="etiquetaCancelar"
          :deshabilitado="cargando"
          autofocus
          @click="cancelar"
        />
        <BotonPeligro
          v-if="peligroso"
          :etiqueta="etiquetaConfirmar"
          :cargando="cargando"
          :deshabilitado="sinMotivo"
          @click="confirmar"
        />
        <BotonPrincipal
          v-else
          :etiqueta="etiquetaConfirmar"
          :cargando="cargando"
          :deshabilitado="sinMotivo"
          @click="confirmar"
        />
      </div>
    </template>
  </DialogoModal>
</template>

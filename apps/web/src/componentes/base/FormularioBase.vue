<script setup lang="ts" generic="T extends Record<string, unknown>, S">
import { computed, nextTick, ref } from "vue";
import type { Formulario } from "@/composables/use-form";
import BotonPrincipal from "./BotonPrincipal.vue";

// Contenedor de formulario: `<form novalidate>`, validación al enviar, foco al primer campo inválido,
// resumen de errores en región aria-live y botón de envío con estado cargando.
// Los campos van en el slot; cada uno enlaza `formulario.valores`, `formulario.errores` y `formulario.alSalir`.
const props = withDefaults(
  defineProps<{
    formulario: Formulario<T, S>;
    enviando?: boolean;
    etiquetaEnviar: string;
    errorGeneral?: string | null;
  }>(),
  { enviando: false, errorGeneral: null },
);

const emit = defineEmits<{ enviar: [valores: S] }>();

const raiz = ref<HTMLFormElement | null>(null);
const resumen = computed(() => Object.values(props.formulario.errores.value) as string[]);

async function alEnviar(): Promise<void> {
  if (props.enviando) return;
  const datos = props.formulario.validar();
  if (datos === null) {
    await nextTick();
    raiz.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return;
  }
  emit("enviar", datos);
}
</script>

<template>
  <form ref="raiz" novalidate class="flex flex-col gap-4" @submit.prevent="alEnviar">
    <div role="alert" aria-live="assertive" :class="{ hidden: !errorGeneral }">
      <p
        v-if="errorGeneral"
        class="rounded-control border border-peligro px-3 py-2 text-sm text-peligro"
      >
        <span class="pi pi-exclamation-triangle mr-1" aria-hidden="true"></span>{{ errorGeneral }}
      </p>
    </div>
    <div aria-live="polite" :class="{ 'sr-only': resumen.length === 0 }">
      <p v-if="resumen.length > 0" class="text-sm text-peligro">
        Revisa {{ resumen.length }} {{ resumen.length === 1 ? "campo" : "campos" }} con errores.
      </p>
    </div>
    <slot />
    <BotonPrincipal :etiqueta="etiquetaEnviar" tipo="submit" :cargando="enviando" bloque />
  </form>
</template>

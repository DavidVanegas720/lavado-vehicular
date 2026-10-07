<script setup lang="ts">
import { onMounted, ref } from "vue";
import { z } from "zod";
import type { DiaOperativo } from "@lavado-vehicular/shared/dominio/dia-operativo";
import type { Centavos } from "@lavado-vehicular/shared/dominio/dinero";
import type { Precio, RangoCilindraje, Servicio } from "@lavado-vehicular/shared/esquemas/catalogo";
import type { MetodoPago, ResumenOrdenTablero } from "@lavado-vehicular/shared/esquemas/ordenes";
import { ESTADOS_ORDEN } from "@lavado-vehicular/shared/esquemas/ordenes";
import type { Trabajador } from "@lavado-vehicular/shared/esquemas/trabajadores";
import { listarPrecios, listarRangos, listarServicios } from "@/api/catalogo";
import { listarTableroDelDia } from "@/api/ordenes";
import { listarTrabajadores } from "@/api/trabajadores";
import BotonPeligro from "@/componentes/base/BotonPeligro.vue";
import BotonPrincipal from "@/componentes/base/BotonPrincipal.vue";
import BotonSecundario from "@/componentes/base/BotonSecundario.vue";
import DialogoConfirmacion from "@/componentes/base/DialogoConfirmacion.vue";
import DialogoModal from "@/componentes/base/DialogoModal.vue";
import EncabezadoPagina from "@/componentes/base/EncabezadoPagina.vue";
import EntradaContrasena from "@/componentes/base/EntradaContrasena.vue";
import EntradaCorreo from "@/componentes/base/EntradaCorreo.vue";
import EntradaDinero from "@/componentes/base/EntradaDinero.vue";
import EntradaNumero from "@/componentes/base/EntradaNumero.vue";
import EntradaTexto from "@/componentes/base/EntradaTexto.vue";
import EstadoVacio from "@/componentes/base/EstadoVacio.vue";
import FormularioBase from "@/componentes/base/FormularioBase.vue";
import SelectorBase from "@/componentes/base/SelectorBase.vue";
import SelectorRangoFechas from "@/componentes/base/SelectorRangoFechas.vue";
import SkeletonCargando from "@/componentes/base/SkeletonCargando.vue";
import TablaBase, { type ColumnaTabla } from "@/componentes/base/TablaBase.vue";
import TarjetaBase from "@/componentes/base/TarjetaBase.vue";
import BadgeEstado from "@/componentes/dominio/BadgeEstado.vue";
import SelectorMetodoPago from "@/componentes/dominio/SelectorMetodoPago.vue";
import SelectorRango from "@/componentes/dominio/SelectorRango.vue";
import SelectorServicio from "@/componentes/dominio/SelectorServicio.vue";
import SelectorTrabajador from "@/componentes/dominio/SelectorTrabajador.vue";
import TarjetaOrden from "@/componentes/dominio/TarjetaOrden.vue";
import { useForm } from "@/composables/use-form";
import { useNotificacion } from "@/composables/use-notificacion";

const notificar = useNotificacion();

// Datos del seed vía la capa de API (nunca literales de dinero).
const servicios = ref<Servicio[]>([]);
const rangos = ref<RangoCilindraje[]>([]);
const precios = ref<Precio[]>([]);
const trabajadores = ref<Trabajador[]>([]);
const ordenes = ref<ResumenOrdenTablero[]>([]);

onMounted(async () => {
  const [s, r, p, t, o] = await Promise.all([
    listarServicios(),
    listarRangos(),
    listarPrecios(),
    listarTrabajadores(),
    listarTableroDelDia(),
  ]);
  if (s.estado === "ok") servicios.value = s.datos;
  if (r.estado === "ok") rangos.value = r.datos;
  if (p.estado === "ok") precios.value = p.datos;
  if (t.estado === "ok") trabajadores.value = t.datos;
  if (o.estado === "ok") ordenes.value = o.datos;
});

// Botones
const cargandoBoton = ref(false);
function simularCarga(): void {
  cargandoBoton.value = true;
  setTimeout(() => {
    cargandoBoton.value = false;
  }, 1500);
}

// Tarjeta interactiva
const seleccionTarjeta = ref(0);

// Campos
const texto = ref("");
const textoError = ref("");
const numero = ref<number | null>(null);
const correo = ref("");
const contrasena = ref("");
const dinero = ref<Centavos | null>(null);

// Selectores
const servicioSel = ref<string | null>(null);
const rangoSel = ref<string | null>(null);
const trabajadorSel = ref<string | null>(null);
const trabajadorOpcionalSel = ref<string | null>(null);
const metodoPago = ref<MetodoPago | null>(null);
const opcionesBase = [
  { valor: "a", etiqueta: "Opción A", descripcion: "Con descripción" },
  { valor: "b", etiqueta: "Opción B" },
  { valor: "c", etiqueta: "Opción C (deshabilitada)", deshabilitada: true },
] as const;
const selectorBaseSel = ref<string | null>(null);

// Formulario
const esquemaForm = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
});
const formulario = useForm(esquemaForm, { nombre: "" });
const enviando = ref(false);
function alEnviar(valores: { nombre: string }): void {
  enviando.value = true;
  setTimeout(() => {
    enviando.value = false;
    notificar.exito(`Formulario válido: ${valores.nombre}`);
  }, 800);
}

// Tabla
const columnasPrecios: ColumnaTabla[] = [
  { campo: "servicio_id", encabezado: "Servicio", ordenable: true },
  { campo: "rango_cilindraje_id", encabezado: "Rango" },
  {
    campo: "precio_centavos",
    encabezado: "Precio",
    formato: "dinero",
    alinear: "derecha",
    ordenable: true,
  },
  { campo: "updated_at", encabezado: "Actualizado", formato: "fecha-hora" },
];
const sinFilas: Precio[] = [];

// Diálogos
const dialogoAbierto = ref(false);
const confirmacionAbierta = ref(false);
const peligrosaAbierta = ref(false);
const motivoAbierta = ref(false);
const resultadoDialogo = ref("");

// Rango de fechas
const rangoFechas = ref<{ desde: DiaOperativo; hasta: DiaOperativo } | null>(null);
</script>

<template>
  <div class="space-y-12">
    <EncabezadoPagina
      titulo="Galería de componentes"
      subtitulo="Solo en desarrollo: todas las variantes y estados."
    />

    <section aria-labelledby="g-botones" class="space-y-4">
      <h2 id="g-botones" class="text-xl font-semibold">Botones</h2>
      <div class="flex flex-wrap items-center gap-3">
        <BotonPrincipal etiqueta="Principal" />
        <BotonPrincipal etiqueta="Con ícono" icono="pi pi-plus" />
        <BotonPrincipal etiqueta="Solo ícono" icono="pi pi-plus" solo-icono aria-label="Agregar" />
        <BotonPrincipal etiqueta="Deshabilitado" deshabilitado />
        <BotonPrincipal etiqueta="Cargando" :cargando="cargandoBoton" @click="simularCarga" />
        <BotonSecundario etiqueta="Secundario" />
        <BotonSecundario etiqueta="Con ícono" icono="pi pi-pencil" />
        <BotonSecundario etiqueta="Deshabilitado" deshabilitado />
        <BotonPeligro etiqueta="Peligro" icono="pi pi-trash" />
        <BotonPeligro etiqueta="Cargando" cargando />
      </div>
      <BotonPrincipal etiqueta="Ancho completo (bloque)" bloque />
    </section>

    <section aria-labelledby="g-tarjeta" class="space-y-4">
      <h2 id="g-tarjeta" class="text-xl font-semibold">Tarjeta base</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <TarjetaBase titulo="Estática" subtitulo="Con todos los slots">
          <template #acciones><BotonSecundario etiqueta="Acción" /></template>
          Contenido principal
          <template #pie>Pie de tarjeta</template>
        </TarjetaBase>
        <TarjetaBase
          titulo="Interactiva"
          subtitulo="Clic, Enter o Espacio"
          interactiva
          etiqueta-accesible="Tarjeta interactiva de ejemplo"
          @seleccionar="seleccionTarjeta++"
        >
          Seleccionada {{ seleccionTarjeta }} veces
        </TarjetaBase>
      </div>
    </section>

    <section aria-labelledby="g-skeleton" class="space-y-4">
      <h2 id="g-skeleton" class="text-xl font-semibold">Skeleton de carga</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <SkeletonCargando variante="texto" :lineas="3" />
        <SkeletonCargando variante="tarjeta" />
        <SkeletonCargando variante="tabla" :filas="3" />
        <SkeletonCargando variante="circulo" />
      </div>
    </section>

    <section aria-labelledby="g-vacio" class="space-y-4">
      <h2 id="g-vacio" class="text-xl font-semibold">Estado vacío</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <EstadoVacio
          titulo="Sin resultados"
          descripcion="Aún no hay nada por mostrar."
          icono="pi pi-inbox"
        />
        <EstadoVacio titulo="Con acción" descripcion="Puedes empezar ahora.">
          <template #accion><BotonPrincipal etiqueta="Crear" icono="pi pi-plus" /></template>
        </EstadoVacio>
        <EstadoVacio titulo="No se pudo cargar" descripcion="Intenta de nuevo." tono="error">
          <template #accion><BotonSecundario etiqueta="Reintentar" /></template>
        </EstadoVacio>
      </div>
    </section>

    <section aria-labelledby="g-encabezado" class="space-y-4">
      <h2 id="g-encabezado" class="text-xl font-semibold">Encabezado de página</h2>
      <EncabezadoPagina titulo="Sin acciones" />
      <EncabezadoPagina titulo="Con acciones" subtitulo="Subtítulo de ejemplo">
        <template #acciones><BotonPrincipal etiqueta="Nueva orden" icono="pi pi-plus" /></template>
      </EncabezadoPagina>
    </section>

    <section aria-labelledby="g-badge" class="space-y-4">
      <h2 id="g-badge" class="text-xl font-semibold">Badge de estado</h2>
      <div class="flex flex-wrap items-center gap-3">
        <BadgeEstado v-for="e in ESTADOS_ORDEN" :key="e" :estado="e" />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <BadgeEstado v-for="e in ESTADOS_ORDEN" :key="e" :estado="e" tamano="sm" />
      </div>
    </section>

    <section aria-labelledby="g-campos" class="space-y-4">
      <h2 id="g-campos" class="text-xl font-semibold">Campos de entrada</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <EntradaTexto
          v-model="texto"
          etiqueta="Texto"
          placeholder="Escribe aquí"
          ayuda="Texto de ayuda"
        />
        <EntradaTexto
          v-model="textoError"
          etiqueta="Texto con error"
          error="Este campo es obligatorio"
          requerido
        />
        <EntradaTexto :model-value="'Valor fijo'" etiqueta="Texto deshabilitado" deshabilitado />
        <EntradaNumero
          v-model="numero"
          etiqueta="Cilindraje"
          sufijo="cc"
          :min="0"
          :max="2000"
          ayuda="Solo enteros"
        />
        <EntradaCorreo v-model="correo" etiqueta="Correo" />
        <EntradaContrasena v-model="contrasena" etiqueta="Contraseña" autocomplete="new-password" />
        <div>
          <EntradaDinero v-model="dinero" etiqueta="Dinero (COP)" ayuda="Escribe pesos enteros" />
          <p class="mt-1 text-sm text-texto-suave">
            Valor del modelo (centavos): <code>{{ dinero === null ? "null" : dinero }}</code>
          </p>
        </div>
      </div>
    </section>

    <section aria-labelledby="g-selectores" class="space-y-4">
      <h2 id="g-selectores" class="text-xl font-semibold">Selectores</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <SelectorBase v-model="selectorBaseSel" etiqueta="Selector base" :opciones="opcionesBase" />
        <SelectorBase
          v-model="selectorBaseSel"
          etiqueta="Selector cargando"
          :opciones="[]"
          cargando
        />
        <SelectorBase
          v-model="selectorBaseSel"
          etiqueta="Selector con error"
          :opciones="opcionesBase"
          error="Elige una opción"
        />
        <SelectorServicio v-model="servicioSel" etiqueta="Servicio" :servicios="servicios" />
        <SelectorServicio
          v-model="servicioSel"
          etiqueta="Servicio (con inactivos)"
          :servicios="servicios"
          incluir-inactivos
        />
        <SelectorRango v-model="rangoSel" etiqueta="Rango de cilindraje" :rangos="rangos" />
        <SelectorTrabajador
          v-model="trabajadorSel"
          etiqueta="Trabajador"
          :trabajadores="trabajadores"
        />
        <SelectorTrabajador
          v-model="trabajadorOpcionalSel"
          etiqueta="Trabajador (permite sin asignar)"
          :trabajadores="trabajadores"
          permite-sin-asignar
        />
        <SelectorMetodoPago v-model="metodoPago" etiqueta="Método de pago" />
      </div>
    </section>

    <section aria-labelledby="g-formulario" class="space-y-4">
      <h2 id="g-formulario" class="text-xl font-semibold">Formulario base</h2>
      <FormularioBase
        :formulario="formulario"
        etiqueta-enviar="Guardar"
        :enviando="enviando"
        @enviar="alEnviar"
      >
        <EntradaTexto
          :id="formulario.id('nombre')"
          v-model="formulario.valores.nombre"
          etiqueta="Nombre"
          requerido
          :error="formulario.errores.value.nombre"
          @blur="formulario.alSalir('nombre')"
        />
      </FormularioBase>
    </section>

    <section aria-labelledby="g-tabla" class="space-y-6">
      <h2 id="g-tabla" class="text-xl font-semibold">Tabla base</h2>
      <h3 class="font-medium">Con datos (ordenar, filtrar, paginar)</h3>
      <TablaBase
        etiqueta="Precios del catálogo"
        :filas="precios"
        :columnas="columnasPrecios"
        clave-fila="id"
        :tamano-pagina="5"
        filtrable
      />
      <h3 class="font-medium">Cargando</h3>
      <TablaBase
        etiqueta="Tabla cargando"
        :filas="sinFilas"
        :columnas="columnasPrecios"
        clave-fila="id"
        cargando
      />
      <h3 class="font-medium">Vacía</h3>
      <TablaBase
        etiqueta="Tabla vacía"
        :filas="sinFilas"
        :columnas="columnasPrecios"
        clave-fila="id"
        texto-vacio="Sin precios"
      />
      <h3 class="font-medium">Con error</h3>
      <TablaBase
        etiqueta="Tabla con error"
        :filas="sinFilas"
        :columnas="columnasPrecios"
        clave-fila="id"
        error
        @reintentar="notificar.info('Reintentando…')"
      />
    </section>

    <section aria-labelledby="g-orden" class="space-y-4">
      <h2 id="g-orden" class="text-xl font-semibold">Tarjeta de orden</h2>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TarjetaOrden
          v-for="o in ordenes.slice(0, 6)"
          :key="o.id"
          :orden="o"
          @seleccionar="notificar.info(`Orden seleccionada: ${o.placa}`)"
        />
      </div>
      <h3 class="font-medium">Compacta</h3>
      <div v-if="ordenes[0]" class="max-w-sm">
        <TarjetaOrden :orden="ordenes[0]" compacta />
      </div>
    </section>

    <section aria-labelledby="g-dialogos" class="space-y-4">
      <h2 id="g-dialogos" class="text-xl font-semibold">Diálogos</h2>
      <div class="flex flex-wrap gap-3">
        <BotonSecundario etiqueta="Abrir diálogo" @click="dialogoAbierto = true" />
        <BotonSecundario etiqueta="Confirmación" @click="confirmacionAbierta = true" />
        <BotonPeligro etiqueta="Confirmación peligrosa" @click="peligrosaAbierta = true" />
        <BotonPeligro etiqueta="Confirmación con motivo" @click="motivoAbierta = true" />
      </div>
      <p aria-live="polite" class="text-sm text-texto-suave">{{ resultadoDialogo }}</p>
      <DialogoModal
        v-model:visible="dialogoAbierto"
        titulo="Diálogo de ejemplo"
        descripcion="Esc o el botón cierran."
      >
        <p>Contenido del diálogo.</p>
      </DialogoModal>
      <DialogoConfirmacion
        v-model:visible="confirmacionAbierta"
        titulo="¿Continuar?"
        mensaje="Esta acción es de ejemplo."
        @confirmar="
          confirmacionAbierta = false;
          resultadoDialogo = 'Confirmado';
        "
        @cancelar="resultadoDialogo = 'Cancelado'"
      />
      <DialogoConfirmacion
        v-model:visible="peligrosaAbierta"
        titulo="¿Eliminar?"
        mensaje="No se puede deshacer."
        etiqueta-confirmar="Eliminar"
        peligroso
        @confirmar="
          peligrosaAbierta = false;
          resultadoDialogo = 'Eliminado (simulado)';
        "
        @cancelar="resultadoDialogo = 'Cancelado'"
      />
      <DialogoConfirmacion
        v-model:visible="motivoAbierta"
        titulo="Anular orden"
        mensaje="Indica el motivo para continuar."
        etiqueta-confirmar="Anular"
        peligroso
        requiere-motivo
        @confirmar="
          (m) => {
            motivoAbierta = false;
            resultadoDialogo = `Motivo: ${m ?? ''}`;
          }
        "
        @cancelar="resultadoDialogo = 'Cancelado'"
      />
    </section>

    <section aria-labelledby="g-notif" class="space-y-4">
      <h2 id="g-notif" class="text-xl font-semibold">Notificaciones</h2>
      <div class="flex flex-wrap gap-3">
        <BotonSecundario
          etiqueta="Éxito"
          icono="pi pi-check"
          @click="notificar.exito('Operación exitosa')"
        />
        <BotonSecundario
          etiqueta="Error"
          icono="pi pi-times"
          @click="notificar.error('Algo salió mal')"
        />
        <BotonSecundario
          etiqueta="Información"
          icono="pi pi-info-circle"
          @click="notificar.info('Dato informativo')"
        />
        <BotonSecundario
          etiqueta="Aviso"
          icono="pi pi-exclamation-triangle"
          @click="notificar.aviso('Revisa este dato')"
        />
      </div>
    </section>

    <section aria-labelledby="g-rango" class="space-y-4">
      <h2 id="g-rango" class="text-xl font-semibold">Selector de rango de fechas</h2>
      <SelectorRangoFechas v-model="rangoFechas" etiqueta="Periodo" />
      <p class="text-sm text-texto-suave">
        Seleccionado:
        <code>{{ rangoFechas ? `${rangoFechas.desde} a ${rangoFechas.hasta}` : "ninguno" }}</code>
      </p>
    </section>
  </div>
</template>

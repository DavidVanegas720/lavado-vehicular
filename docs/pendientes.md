# Pendientes

Este archivo tiene dos tipos de entradas:

1. **Preguntas abiertas (P-X):** decisiones de producto que David todavía no tomó. Cada una bloquea alguna rebanada específica. Se responden acá mismo cuando David decida.
2. **Hallazgos (H-X):** deuda técnica encontrada en el camino, ajena a la tarea que la descubrió. Se registran acá para no descarrilar la tarea que los encontró.

Formato de un hallazgo: 10 líneas máximo. Si necesita más, es una tarea.

---

## Preguntas abiertas — estado por decisión D-28

Con la decisión D-28 (frontend primero, backend después), estas siete preguntas **no bloquean ninguna rebanada de F1**. Los mocks adoptan una asunción explícita para cada una, la registran en un comentario `// P-X: se asume X`, y se revalidan al cerrar F1 antes de arrancar F2.

**Al cerrar F1, si Carlos al probar los mocks confirma una respuesta distinta a la asumida, se ajusta el mock (rápido) antes de codificar el backend (caro).**

### P-A — Pago excedente: concepto libre o lista predefinida

**Qué es:** cuando un cliente paga más del total de ítems, el sistema exige un `concepto`. Falta decidir si es texto libre o una lista predefinida.
**Asunción del mock en F1:** texto libre con sugerencias mostradas como chips clickables (propina, sin cambio, ajuste). Cubre ambos comportamientos y deja ver a Carlos cómo se siente.
**Bloquea:** F2-3 (cobrar).
**Estado:** abierto, se revalida al cerrar F1.

### P-B — Pago de orden anulada al re-crear

**Qué es:** cuando se anula una orden ya cobrada y se crea una nueva (caso "cobré el paquete equivocado"), el pago viejo queda en la orden anulada. Falta decidir el manejo.
**Asunción del mock en F1:** la orden re-creada muestra un aviso "pago previo acreditado" con el monto de la orden anulada. Si el total nuevo es igual al viejo, se marca automáticamente como cobrada; si es distinto, se pide la diferencia.
**Bloquea:** F2-5 (anulaciones).
**Estado:** abierto, se revalida al cerrar F1.

### P-C — Descuento: campo separado o dentro del concepto del pago

**Qué es:** cuando el dueño aplica un descuento, falta decidir si eso se registra como campo `descuento_centavos` explícito en la orden, o como pago menor con concepto.
**Asunción del mock en F1:** campo separado en la orden. Permite que los reportes distingan "vendió menos" de "descontó por decisión".
**Bloquea:** F2-5 (anulaciones/descuentos).
**Estado:** abierto, se revalida al cerrar F1.

### P-D — Adicionales en orden ya cobrada

**Qué es:** si la moto está lavándose y el cliente pide un adicional que no estaba en la orden original, ¿se agrega a la existente o se crea una nueva?
**Asunción del mock en F1:** se crea una orden aparte, con el mismo vehículo, marcada como "adicional de #<id-orden-original>". Respeta la regla "COBRADA es inmutable en sus ítems".
**Bloquea:** F2-3 o F2-5.
**Estado:** abierto, se revalida al cerrar F1.

### P-E — Obligatoriedad del cierre de caja

**Qué es:** si Carlos no cierra la caja un día, ¿bloquea el día siguiente o lo deja pasar?
**Asunción del mock en F1:** aviso persistente al abrir el día siguiente ("hay 1 día sin cerrar: <fecha>. Cerrar ahora"), pero no bloquea. Se puede seguir operando.
**Bloquea:** F2-6 (cierre de caja).
**Estado:** abierto, se revalida al cerrar F1.

### P-F — Órdenes creadas fuera del horario 8am-5pm

**Qué es:** el horario del negocio es 8am a 5pm. ¿Qué pasa si se registra una moto a las 5:15pm?
**Asunción del mock en F1:** se acepta, se cuenta al día operativo actual, aparece un aviso pequeño ("fuera de horario habitual"). Sin bloqueo.
**Bloquea:** F2-2 (crear orden).
**Estado:** abierto, se revalida al cerrar F1.

### P-G — Asignación del lavador: obligatoria o diferible

**Qué es:** ¿es obligatorio elegir un lavador al crear, o se puede diferir?
**Asunción del mock en F1:** diferible. La orden puede estar en estado CREADA sin trabajador; el congelamiento del % ocurre al asignar, no al crear. Es más flexible operativamente.
**Bloquea:** F2-2 (crear orden).
**Estado:** abierto, se revalida al cerrar F1.

---

## Preguntas nuevas que pueden aparecer durante F1

Estas son preguntas de dominio que solo se van a hacer visibles cuando alguien vea las vistas. Se agregan como P-X nuevas si aparecen.

- Casos de uso que las vistas actuales no cubren (ej. "y qué hago si el cliente quiere pagar la mitad hoy y la mitad mañana").
- Términos que Carlos usa distinto a como el sistema los llama.
- Flujos que la lógica del negocio soporta pero la UX no facilita.

---

## Hallazgos

### H-01 — La asunción de P-G contradice D-20 y el modelo
**Qué es:** P-G asume "el % se congela al asignar"; D-20 dice "al crear". `porcentaje_comision_congelado` es `Int` no nulo, pero `trabajador_id` es nullable.
**Qué se rompe si nadie lo atiende:** F1-3 no puede modelar una orden sin lavador sin violar el esquema o D-20.
**Mitigación actual:** FP-0 copia el modelo tal cual; el seed de F1-1 asigna lavador a todas las órdenes.
**Cuándo se descubrió:** 2026-10-07, planificación FP-0/F1-1 (arquitecto).
**Estado:** abierto — David decide antes de F1-3.

### H-02 — D-01 fija Node 20, que llegó a fin de soporte en abril de 2026
**Qué es:** el equipo local corre Node 24 (LTS). FP-0 pone `engines.node: ">=24"`.
**Qué se rompe si nadie lo atiende:** en F2, Render y CI podrían arrancar en una versión sin parches de seguridad.
**Cuándo se descubrió:** 2026-10-07, planificación FP-0.
**Estado:** abierto — David aprueba enmendar D-01 a Node 24.

### H-03 — No hay regla de redondeo para la comisión
**Qué es:** `precio × porcentaje / 10000` puede dar fracción de centavo (p. ej. 4500 sobre $25.001). Ningún doc dice si se redondea hacia arriba, hacia abajo o al más cercano.
**Qué se rompe si nadie lo atiende:** la comisión estimada de F1-3 y los reportes de F1-5 pueden diferir del backend por centavos.
**Cuándo se descubrió:** 2026-10-07, planificación F1-1.
**Estado:** abierto — David decide antes de F1-3 (propuesta: al centavo más cercano, mitad hacia arriba).

### H-04 — gitleaks, Dependabot, CI remoto y `pnpm audit` diferidos
**Qué es:** David los sacó de FP-0. Solo existe `pnpm verificar` local.
**Qué se rompe si nadie lo atiende:** se puede commitear un secreto o mergear con lint/tests rotos sin que nada lo frene.
**Mitigación actual:** `.env` en `.gitignore`; F1 no usa secretos.
**Cuándo se descubrió:** 2026-10-07, planificación FP-0.
**Estado:** abierto — hacer antes del primer secreto real (FP-F2-1 a más tardar).

### H-05 — `.plan/` "no se commitea a main" (arquitectura) vs agentes que lo necesitan
**Qué es:** si `.plan/` no se versiona, los agentes en otro worktree o clon no ven el plan aprobado ni el revisor lo puede comparar con el diff.
**Qué se rompe si nadie lo atiende:** planes perdidos o desincronizados entre chats.
**Propuesta:** versionar `.plan/` (FP-0 no lo ignora).
**Cuándo se descubrió:** 2026-10-07, planificación FP-0.
**Estado:** abierto — David confirma.

### H-06 — La asunción de P-C (`descuento_centavos`) no existe en el modelo
**Qué es:** P-C asume un campo de descuento separado en la orden; `modelo-datos.md` no lo tiene. Los esquemas de FP-0 copian solo el modelo.
**Qué se rompe si nadie lo atiende:** F1-3 agregaría un campo ad hoc sin fuente de verdad.
**Propuesta:** F1-3 lo agrega a `esquemas/ordenes.ts` con `// P-C` y a modelo-datos como "provisional".
**Cuándo se descubrió:** 2026-10-07, planificación FP-0.
**Estado:** abierto — revisar al planificar F1-3.

### H-07 — La configuración del negocio no tiene módulo en la arquitectura
**Qué es:** los 9 módulos de `arquitectura.md` no incluyen leer/editar `Negocio` (horario, zona), y F1-1 necesita esos datos para el día operativo; F1-4 los edita.
**Qué se rompe si nadie lo atiende:** la ruta `GET /api/negocio/actual` de F1-1 queda sin dueño en F2.
**Mitigación actual:** F1-1 usa módulo `"negocio"` provisional en el cliente.
**Cuándo se descubrió:** 2026-10-07, planificación F1-1.
**Estado:** abierto — decidir antes de F1-4 (¿módulo nuevo o dentro de `usuarios`/`auth`?).

### H-08 — No está definida la semana de los reportes
**Qué es:** "reporte semanal" no dice si la semana es lunes–domingo u otra. `SelectorRangoFechas` (F1-1) tiene atajo "Esta semana".
**Qué se rompe si nadie lo atiende:** los totales semanales no coinciden con cómo los cuenta Carlos.
**Mitigación actual:** F1-1 asume lunes–domingo con comentario `// H-08`.
**Cuándo se descubrió:** 2026-10-07, planificación F1-1.
**Estado:** abierto — confirmar con Carlos antes de F1-5.

### H-09 — PrimeVue 5 exige clave de licencia (Community gratuita con renovación anual)
**Qué es:** `primevue@5` usa `@primeui/license-manager`; sin clave avisa por `console.warn`. La licencia gratuita pide cumplir criterios (ingresos, nº de devs) y confirmar elegibilidad cada año.
**Qué se rompe si nadie lo atiende:** aviso de licencia en consola/UI y posible incumplimiento al pasar a plan pago; choca con la restricción de capa gratuita.
**Opciones:** obtener la clave Community, o fijar `primevue@^4` (MIT, sin clave). Ver E-014.
**Cuándo se descubrió:** 2026-10-07, FP-0 paso 5.
**Estado:** abierto — David decide antes de F1-1.

### Plantilla de hallazgo

```markdown
### H-XX — <título de una línea>

**Qué es:** una o dos líneas.
**Qué se rompe si nadie lo atiende:** una línea concreta.
**Cuándo se descubrió:** fecha + tarea que lo encontró.
**Estado:** abierto / en curso / cerrado.
```

Máximo 10 líneas por hallazgo. Sin excepciones.

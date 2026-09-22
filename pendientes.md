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

*Vacío al inicio del proyecto. Los hallazgos se agregan durante el trabajo de las tareas.*

### Plantilla de hallazgo

```markdown
### H-XX — <título de una línea>

**Qué es:** una o dos líneas.
**Qué se rompe si nadie lo atiende:** una línea concreta.
**Cuándo se descubrió:** fecha + tarea que lo encontró.
**Estado:** abierto / en curso / cerrado.
```

Máximo 10 líneas por hallazgo. Sin excepciones.

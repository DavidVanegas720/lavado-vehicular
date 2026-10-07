# Registro de construcción

Bitácora viva de la Fase 1 en adelante. Complementa (no reemplaza) a `docs/decisiones.md` y
`docs/pendientes.md`.

| Archivo | Qué guarda | Quién escribe |
|---|---|---|
| [progreso.md](progreso.md) | Checklist de FP-0 y F1-1..F1-5 con estado y fecha | Chat de tarea al cerrar cada paso; arquitecto al aprobar |
| [errores.md](errores.md) | Errores encontrados (build, tests, docs inconsistentes) y su solución | Quien lo encuentre, al resolverlo |
| [decisiones-tomadas.md](decisiones-tomadas.md) | Decisiones menores de construcción (no ameritan D-XX) | Chat de tarea o arquitecto, en el momento |

## Dónde va cada cosa

- **Decisión de producto o que cambia una D-XX** → no va acá: se consulta a David y va a `docs/decisiones.md`.
- **Pregunta abierta de dominio** → `docs/pendientes.md` como P-X.
- **Deuda o hueco ajeno a la tarea** → `docs/pendientes.md` como H-XX (≤ 10 líneas).
- **Decisión técnica menor tomada en el camino** → `decisiones-tomadas.md` (DM-XX).
- **Algo falló y se arregló** → `errores.md` (E-XXX), aunque haya tomado cinco minutos.

## Reglas

- Entradas cortas: máximo 8 líneas cada una. Fecha ISO (`2026-10-07`) y tarea/paso (`F1-1/P2-C`).
- Nunca se borran entradas: se marcan `superada por DM-XX` o `cerrado`.
- Numeración correlativa, sin reutilizar números.

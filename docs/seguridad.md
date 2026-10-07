# Seguridad

Checklist de 20 reglas de seguridad aplicada al proyecto. Cada regla está clasificada por cuándo se implementa y con qué herramienta concreta. Las diferidas están diferidas con razón registrada, no por descuido.

Este documento se lee al empezar cualquier tarea que toque autenticación, autorización, entrada de usuario, respuesta HTTP, subida de archivos o despliegue.

## Nivel 1 — Se implementa desde el bootstrap

Trece reglas que van en P-1 (bootstrap del monorepo) y P-3 (hosting). Son baratas ahora y caras después.

### 1. Ocultar claves API (P-1)
- Variables de entorno en `.env` (fuera de git).
- `.env.example` con las claves esperadas pero sin valores.
- En código: `process.env.NEON_URL`, nunca literales.
- Verificar en cada arranque que las claves esperadas existen; fallar ruidosamente si no.

### 2. Eliminar secretos de git (P-1)
- La mejor eliminación es no meterlos nunca.
- Pre-commit hook con `gitleaks` que corta el commit si detecta un patrón de secreto.
- Si por accidente entró uno: rotarlo inmediatamente (no basta con quitarlo del commit siguiente; ya quedó en el historial).

### 3. SSL a la base de datos (P-3)
- `DATABASE_URL` con `?sslmode=require`.
- Neon lo obliga por defecto, así que "no hacer nada" ya cumple. Verificarlo igual.

### 6. Autenticación forzada por defecto (P-1)
- Hook global de Fastify (`plugins/exigir-sesion.ts`) que corre antes que todo lo que no sea explícitamente público.
- Endpoints públicos (`/api/salud`, `/api/auth/login`) opt-out explícito con `{ config: { publico: true } }`.
- Así el default seguro no se olvida en ninguna ruta nueva.

### 7. Restringir acceso a registros (P-1)
- El filtro `negocio_id` vive en `RepositorioBase` y se aplica automáticamente. Ver `arquitectura.md`.
- El chequeo de rol vive en el servicio: helper `exigirRol('DUENO')` corre antes de la lógica.
- El operador nunca recibe datos de otro negocio; nunca puede ejecutar operaciones de dueño.

### 8. Bloquear manipulación de campos (P-1)
- Todo request se parsea con Zod. Los campos que no están en el esquema se descartan.
- Nunca `req.body as X` sin pasar por Zod.
- Nunca se acepta `rol`, `negocio_id`, `porcentaje_comision_congelado` desde el request (son campos que el servidor decide).

### 9. Cookies de sesión protegidas (R1)
- `httpOnly: true`, `Secure: true`, `SameSite: 'lax'`.
- Token opaco (no JWT). La sesión vive en tabla `sesiones` y se revoca borrando fila. Ver D-13 en `decisiones.md`.
- Se materializa en Rebanada 1 con el endpoint de login.

### 10. Hashear contraseñas (R1)
- `argon2id` con parámetros por defecto de la librería `argon2`.
- Nunca bcrypt. Nunca scrypt. Nunca sha256 con salt manual.
- El endpoint de cambio de contraseña re-verifica la contraseña actual antes de guardar la nueva.

### 14. Validar todas las entradas (P-1)
- Zod en todo request. Ya en `convenciones-codigo.md`.
- Los tipos de TypeScript se derivan del esquema, no al revés.

### 15. Escapar contenido del usuario (P-1)
- Vue escapa por defecto en templates (`{{ variable }}`).
- **Prohibido `v-html` con contenido que venga del usuario o de la base.** Solo con texto que el propio código controla (mensajes fijos, iconos SVG).
- En el backend, si en algún caso raro se genera HTML (respuestas de error a un template, exportación), usar librería que escape (nunca concatenar strings).

### 18. Cabeceras de seguridad (P-1)
- `@fastify/helmet` registrado en el bootstrap del backend.
- Habilita: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, entre otras.
- La CSP se configura estricta: `default-src 'self'`, y se aflojan solo las directivas que la aplicación necesita, nunca al revés.

### 19. Forzar HTTPS (P-3)
- Render sirve solo HTTPS por default.
- Cloudflare Pages fuerza HTTPS por default.
- La cookie es `Secure`, así que si de milagro llegara una petición por HTTP la sesión no viaja.
- HSTS lo aplica helmet.

### 20. Escanear dependencias (P-3)
- Dependabot activado en la configuración del repo en GitHub (5 clicks, gratis).
- `pnpm audit` corre en el pipeline de CI y falla si hay vulnerabilidades altas.
- Actualizar dependencias es tarea de "pago de deuda" cada dos rebanadas.

## Nivel 2 — Con la primera funcionalidad que lo exija (R1)

### 11. Limitar intentos de inicio de sesión (R1)
- `@fastify/rate-limit` con regla estricta en `/api/auth/login`: 5 intentos por IP cada 15 minutos.
- Después de 5 fallidos, respuesta 429 con `Retry-After`.
- **No decir en el mensaje si el email existe o no** — respuesta genérica ("credenciales inválidas") tanto si el usuario no existe como si la contraseña falló.
- Se agrega junto con el endpoint de login.

### 17. Limitar respuestas de API en general (R1)
- El mismo plugin con una regla laxa global: 100 requests por minuto por IP.
- Se agrega junto con la regla 11 porque es la misma configuración.
- Endpoints internos del cron externo (`/api/salud`, `/api/respaldo-diario`) tienen su propia regla con lista blanca del IP del cron.

## Nivel 3 — Cuando aparezca la feature que lo requiera

### 13. Monitorizar consultas a la DB (diferido)
- Neon ya lo hace en su dashboard: queries lentas, patrones, uso de CPU.
- En la aplicación, el logger de Prisma se activa solo si aparece un problema real de performance.
- No encender "por si acaso" — llena Sentry de ruido y consume free tier.

### 16. Restringir subida de archivos (cuando aparezca la feature)
- **No hay subida de archivos en el sistema todavía.**
- Cuando aparezca una feature que la requiera (foto de la moto al recibirla, comprobante escaneado), en esa misma tarea se implementa:
  - Whitelist de tipos MIME (nunca por extensión del archivo).
  - Tamaño máximo por endpoint (ej. 5 MB para imágenes).
  - Almacenamiento fuera del contenedor de la API (Cloudflare R2).
  - Nombre generado por el servidor (nunca aceptar el nombre del cliente).
  - Validación adicional si el tipo lo permite (dimensiones de imagen, magic bytes).

## Nivel 4 — Diferidas por decisión explícita

Estas tres están en la checklist general pero aplicarlas al proyecto actual sería gasto sin retorno.

### 4. Activar RLS (diferido — decisión D-07)
- La decisión D-07 en `decisiones.md` fija que RLS no se activa mientras haya un solo tenant.
- La mitigación equivalente (filtro por `negocio_id` en `RepositorioBase`) está desde P-1.
- Cuando aparezca un segundo negocio real (que pague), RLS se agrega en una migración sin tocar código de aplicación, porque el filtro ya está centralizado.

### 5. Cifrar datos sensibles a nivel aplicación (diferido)
- Neon cifra en disco por default. Cifrado adicional a nivel de aplicación tiene un costo real (complejidad de queries, imposibilidad de indexar campos cifrados, gestión de llaves).
- **En este dominio no hay campos que lo justifiquen:** placas, nombres, precios, montos son información operativa normal, no información personal identificable ni datos financieros sensibles.
- Si algún día se guardaran datos de tarjeta de crédito (no está en el plan), documentos de identidad, o información médica, se re-evalúa.
- **Regla:** antes de guardar un campo nuevo, preguntarse "¿esto es información personal o financiera sensible?". Si la respuesta es sí, esa tarea incluye cifrado.

### 12. Protección contra bots (diferido)
- Los CAPTCHAs son útiles contra bots que atacan endpoints públicos (signup, contact, comment).
- **No hay signup público en el sistema.** David como superadmin crea negocios por script. El dueño crea sus operadores desde dentro con sesión.
- El único endpoint expuesto a internet sin sesión es `/api/auth/login`, protegido por rate limiting (regla 11), que es más efectivo contra ataque real que un CAPTCHA.
- El día que se abra registro público (si es que se abre), se agrega hCaptcha (gratis en su tier básico).

## Herramientas concretas

| Herramienta | Regla | Nivel |
|---|---|---|
| `gitleaks` (pre-commit) | 2 | P-1 |
| `@fastify/helmet` | 18 | P-1 |
| `@fastify/cookie` | 9 | R1 |
| `@fastify/rate-limit` | 11, 17 | R1 |
| `argon2` (npm) | 10 | R1 |
| Zod | 8, 14 | P-1 |
| Dependabot (GitHub) | 20 | P-3 |
| `pnpm audit` (CI) | 20 | P-3 |
| Neon (native) | 3, 5, 13 | P-3 |
| Render (native) | 19 | P-3 |
| Cloudflare Pages (native) | 19 | P-3 |

## Al empezar cualquier tarea nueva

Antes de escribir la primera línea, revisar si la tarea toca alguno de estos puntos:

- ¿Recibe input de usuario? → regla 14 (Zod).
- ¿Renderiza algo del usuario? → regla 15 (no `v-html` con datos externos).
- ¿Persiste o consulta datos? → regla 7 (repositorio con filtro `negocio_id`) + regla 8 (Zod filtra campos, servidor decide los que no vienen del usuario).
- ¿Agrega un endpoint? → regla 6 (default protegido por auth, opt-out explícito para públicos).
- ¿Toca contraseñas o sesiones? → reglas 9, 10, 11.
- ¿Introduce una dependencia nueva? → regla 20 (verificar que `pnpm audit` la aprueba).
- ¿Guarda un campo nuevo? → preguntarse si es sensible; si sí, esa tarea incluye cifrado (regla 5).

## Al cerrar una tarea

- ¿Alguna variable de entorno nueva? Documentarla en `.env.example`.
- ¿Alguna clave o secreto se filtró en un log o error? Rotar inmediatamente.
- ¿Se agregó una ruta pública? Registrarla en el hook global y justificar en el informe por qué es pública.

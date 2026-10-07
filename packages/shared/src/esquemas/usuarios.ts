import { z } from "zod";
import { esquemaFechaHora, esquemaId, esquemaTextoNoVacio } from "./comun";

export const ROLES = ["SUPERADMIN", "DUENO", "OPERADOR"] as const;
export const esquemaRol = z.enum(ROLES);
export type Rol = (typeof ROLES)[number];

/** Salida pública del usuario: sin `password_hash` ni sesiones (nunca salen del backend). */
export const esquemaUsuarioPublico = z.object({
  id: esquemaId,
  negocio_id: esquemaId.nullable(), // null para SUPERADMIN
  email: z.email({ error: "El correo no es válido" }),
  nombre: esquemaTextoNoVacio,
  rol: esquemaRol,
  activo: z.boolean(),
  created_at: esquemaFechaHora,
  updated_at: esquemaFechaHora,
});

export type UsuarioPublico = z.infer<typeof esquemaUsuarioPublico>;

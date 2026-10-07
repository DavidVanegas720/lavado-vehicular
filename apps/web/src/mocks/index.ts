import { registrarMocksCatalogo } from "./catalogo";
import { registrarMocksNegocio } from "./negocio";
import { registrarMocksOrdenes } from "./ordenes";
import { registrarMocksTrabajadores } from "./trabajadores";

// Registra todos los manejadores mock una sola vez (los módulos ES se evalúan una vez).
registrarMocksNegocio();
registrarMocksCatalogo();
registrarMocksTrabajadores();
registrarMocksOrdenes();

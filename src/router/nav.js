export const NAV = {
  operator: [
    { label: 'Nueva lavada', path: '/new-wash' },
    { label: 'Mis órdenes del turno', path: '/my-orders' },
    { label: 'Cierre de turno', path: '/shift-close' },
  ],
  admin: [
    { label: 'Turnos', path: '/shifts' },
    { label: 'Catálogo', path: '/catalog' },
    { label: 'Lavadores', path: '/washers' },
    { label: 'Operadores', path: '/operators' },
    { label: 'Pagos a lavadores', path: '/washer-pay' },
    { label: 'Historial de placas', path: '/plate-history' },
  ],
  superadmin: [{ label: 'Negocios', path: '/businesses' }],
}

export const homeOf = (role) => NAV[role][0].path

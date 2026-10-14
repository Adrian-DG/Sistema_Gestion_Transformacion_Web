/** Espejo de AppPermission del backend (nombres de rol en el JWT). */
export enum Permiso {
  Administrador = 'Administrador',
  GestionVehiculos = 'GestionVehiculos',
  GestionAsignaciones = 'GestionAsignaciones',
  GestionPolizas = 'GestionPolizas',
  GestionCombustible = 'GestionCombustible',
  GestionPersonas = 'GestionPersonas',
  GestionUsuarios = 'GestionUsuarios',
  GestionTaller = 'GestionTaller',
  GestionInventarioPiezas = 'GestionInventarioPiezas',
  ReactivarVehiculos = 'ReactivarVehiculos',
}

/**
 * Indica si los permisos del usuario cubren alguno de los requeridos. Administrador cubre todo,
 * como en las políticas del backend. Sin requeridos, basta con estar autenticado.
 */
export function cumplePermisos(
  delUsuario: readonly string[],
  requeridos: readonly Permiso[],
): boolean {
  if (requeridos.length === 0) return true;
  if (delUsuario.includes(Permiso.Administrador)) return true;
  return requeridos.some((p) => delUsuario.includes(p));
}

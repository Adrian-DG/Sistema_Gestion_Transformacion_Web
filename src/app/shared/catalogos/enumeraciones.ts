/** Espejo de SexoEnum del backend (los valores numéricos son los que recibe la API). */
export const SEXOS = [
  { valor: 0, codigo: 'Masculino', nombre: 'Masculino' },
  { valor: 1, codigo: 'Femenino', nombre: 'Femenino' },
] as const;

/** Espejo de InstitucionEnum del backend. */
export const INSTITUCIONES = [
  { valor: 1, codigo: 'MIDE', nombre: 'Ministerio de Defensa' },
  { valor: 2, codigo: 'ERD', nombre: 'Ejército de República Dominicana' },
  { valor: 3, codigo: 'ARD', nombre: 'Armada de República Dominicana' },
  { valor: 4, codigo: 'FARD', nombre: 'Fuerza Aérea de República Dominicana' },
  { valor: 5, codigo: 'PN', nombre: 'Policía Nacional' },
] as const;

/** La Armada usa su propia denominación de rangos (Rango.NombreArmada). */
export const INSTITUCION_ARMADA = 3;

/** Convierte el texto que devuelve la API ("Femenino", "ARD") al valor que espera al guardar. */
export function valorPorCodigo(
  lista: readonly { valor: number; codigo: string }[],
  codigo: string | null | undefined,
): number | null {
  return lista.find((e) => e.codigo === codigo)?.valor ?? null;
}

export function nombreInstitucion(codigo: string | null | undefined): string {
  return INSTITUCIONES.find((i) => i.codigo === codigo)?.nombre ?? codigo ?? '';
}

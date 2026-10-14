import { HttpContextToken } from '@angular/common/http';
import { environment as Prod } from '../../../environments/environment';
import { environment as Dev } from '../../../environments/environment.development';
import { isDevMode } from '@angular/core';

/** Construye la URL completa de un endpoint, ej. `api('configuracion/apariencia')`. */
export function api(ruta: string): string {
  const isDev = isDevMode() ? Dev : Prod;
  return `${isDev.apiUrl}/api/${ruta.replace(/^\/+/, '')}`;
}

export function esUrlApi(url: string): boolean {
  return url.startsWith(`${(isDevMode() ? Dev : Prod).apiUrl}/api/`);
}

/** Respuesta paginada del backend (PagedData). */
export interface Paginado<T> {
  rows: T[] | null;
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
}

/** Error normalizado a partir de ProblemDetails. */
export interface ApiError {
  status: number;
  /** Código del backend, ej. "Asignacion.VehiculoOcupado" o "Validation.General". */
  codigo: string;
  mensaje: string;
  /** Errores por campo (camelCase), solo en validaciones. */
  errores: Record<string, string[]>;
}

export function esApiError(valor: unknown): valor is ApiError {
  return typeof valor === 'object' && valor !== null && 'status' in valor && 'codigo' in valor;
}

/**
 * Evita el aviso global de error. Úselo cuando el componente muestra el error por su cuenta
 * (ej. formularios con errores por campo).
 */
export const SIN_AVISO_ERROR = new HttpContextToken<boolean>(() => false);

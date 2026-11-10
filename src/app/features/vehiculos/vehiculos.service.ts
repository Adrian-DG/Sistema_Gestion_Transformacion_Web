import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';
import { AsignacionResumen, EstatusAsignacion } from '../asignaciones/asignaciones.service';

/** Espejo de EstatusVehiculo del backend. NoDisponible: en misión; los demás los fija el taller. */
export type EstatusVehiculo = 'Disponible' | 'NoDisponible' | 'EnMantenimiento' | 'Inactivo';

export const NOMBRES_ESTATUS_VEHICULO: Record<EstatusVehiculo, string> = {
  Disponible: 'Disponible',
  NoDisponible: 'No disponible',
  EnMantenimiento: 'En mantenimiento',
  Inactivo: 'Inactivo',
};

export const nombreEstatusVehiculo = (estatus: string): string =>
  NOMBRES_ESTATUS_VEHICULO[estatus as EstatusVehiculo] ?? estatus;

/** Espejo de CondicionVehiculo. */
export const CONDICION_VEHICULO = { Nuevo: 1, Usado: 2 } as const;
export type CondicionVehiculo = (typeof CONDICION_VEHICULO)[keyof typeof CONDICION_VEHICULO];

/** Espejo de VistaVehiculo: al ingresar se exige una foto de cada una. */
export const VISTAS_VEHICULO = [
  { valor: 1, clave: 'frente', nombre: 'Frente' },
  { valor: 2, clave: 'ladoIzquierdo', nombre: 'Lado izquierdo' },
  { valor: 3, clave: 'ladoDerecho', nombre: 'Lado derecho' },
  { valor: 4, clave: 'trasera', nombre: 'Trasera' },
] as const;
export type VistaVehiculo = (typeof VISTAS_VEHICULO)[number]['valor'];
export type ClaveVista = (typeof VISTAS_VEHICULO)[number]['clave'];

export interface FotoVehiculo {
  id: string;
  vista: VistaVehiculo;
  nombreArchivo: string;
  fecha: string;
}

/** Cuerpo de una foto (FotoVehiculoRequest); Base64 sin prefijo. */
export interface FotoNueva {
  vista: VistaVehiculo;
  nombreArchivo: string;
  contentType: string;
  fileBase64: string;
}

export interface VehiculoResumen {
  id: string;
  chasis: string;
  matricula: string;
  placa: string;
  ficha: string | null;
  marca: string;
  modelo: string;
  fabricacion: number;
  color: string;
  tipo: string;
  estatus: EstatusVehiculo;
  kilometraje: number;
  enGarantia: boolean;
}

export interface VehiculoDetalle {
  id: string;
  chasis: string;
  matricula: string;
  placa: string;
  ficha: string | null;
  fabricacion: number;
  marcaId: string;
  marca: string;
  modeloId: string;
  modelo: string;
  tipoId: string;
  tipo: string;
  colorId: string;
  color: string;
  estatus: EstatusVehiculo;
  condicion: CondicionVehiculo;
  /** Kilometraje con que ingresó a la flota. */
  kilometrajeIngreso: number;
  fechaIngreso: string;
  kilometraje: number;
  fotos: FotoVehiculo[];
  /** yyyy-MM-dd */
  garantiaVence: string | null;
  garantiaKilometraje: number | null;
  garantiaTallerId: string | null;
  garantiaTaller: string | null;
  /** Garantía vigente hoy por fecha y kilometraje. */
  enGarantia: boolean;
}

export interface DatosVehiculo {
  chasis: string;
  matricula: string;
  placa: string;
  ficha: string | null;
  fabricacion: number;
  marcaId: string;
  modeloId: string;
  tipoId: string;
  colorId: string;
  kilometraje: number;
  tieneGarantia: boolean;
  garantiaVence: string | null;
  garantiaKilometraje: number | null;
  garantiaTallerId: string | null;
}

/** Ingreso a la flota: además de los datos, la condición y las cuatro fotos. */
export interface NuevoVehiculo extends DatosVehiculo {
  condicion: CondicionVehiculo;
  fotos: FotoNueva[];
}

export interface FiltroVehiculos {
  pagina: number;
  tamano: number;
  busqueda: string;
}

export interface FiltroHistorial {
  pagina: number;
  tamano: number;
  estatus: EstatusAsignacion | null;
}

/** Los formularios muestran los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

/** Flota de vehículos. No se eliminan: la baja (en el taller) los deja inactivos. */
@Injectable({ providedIn: 'root' })
export class VehiculosService {
  private readonly http = inject(HttpClient);

  listar(filtro: FiltroVehiculos): Observable<Paginado<VehiculoResumen>> {
    let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
    if (filtro.busqueda) params = params.set('param', filtro.busqueda);
    return this.http.get<Paginado<VehiculoResumen>>(api('vehiculos'), { params });
  }

  obtener(id: string): Observable<VehiculoDetalle> {
    return this.http.get<VehiculoDetalle>(api(`vehiculos/${id}`));
  }

  crear(datos: NuevoVehiculo): Observable<string> {
    return this.http.post<string>(api('vehiculos'), datos, SIN_AVISO);
  }

  /** Historial de asignaciones del vehículo, la de salida más reciente primero. */
  asignaciones(id: string, filtro: FiltroHistorial): Observable<Paginado<AsignacionResumen>> {
    let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
    if (filtro.estatus) params = params.set('estatus', filtro.estatus);
    return this.http.get<Paginado<AsignacionResumen>>(api(`vehiculos/${id}/asignaciones`), {
      params,
    });
  }

  /** Imagen de una vista (la petición lleva el token, por eso no se usa la URL directa en <img>). */
  foto(id: string, vista: VistaVehiculo): Observable<Blob> {
    return this.http.get(api(`vehiculos/${id}/fotos/${vista}`), {
      responseType: 'blob',
      ...SIN_AVISO,
    });
  }

  /** Reemplaza la foto de una vista; la anterior queda en el historial. */
  reemplazarFoto(id: string, foto: FotoNueva): Observable<void> {
    return this.http.put<void>(api(`vehiculos/${id}/fotos`), foto, SIN_AVISO);
  }

  /** Solo los datos; el estatus lo cambia el taller. */
  actualizar(id: string, datos: DatosVehiculo): Observable<void> {
    return this.http.put<void>(api(`vehiculos/${id}`), datos, SIN_AVISO);
  }
}

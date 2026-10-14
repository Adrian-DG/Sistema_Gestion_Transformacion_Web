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

  crear(datos: DatosVehiculo): Observable<string> {
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

  /** Solo los datos; el estatus lo cambia el taller. */
  actualizar(id: string, datos: DatosVehiculo): Observable<void> {
    return this.http.put<void>(api(`vehiculos/${id}`), datos, SIN_AVISO);
  }
}

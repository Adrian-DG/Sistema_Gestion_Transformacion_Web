import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';

export type Cobertura = 'Vigente' | 'PorVencer' | 'Vencida';

export interface PolizaResumen {
  id: string;
  vehiculoId: string;
  placa: string;
  vehiculo: string;
  numeroPoliza: string;
  aseguradora: string;
  /** Fechas en formato yyyy-MM-dd. */
  fechaExpedicion: string;
  fechaEfectividad: string;
  fechaVencimiento: string;
  cobertura: Cobertura;
  diasRestantes: number;
}

export interface PolizaDetalle {
  id: string;
  vehiculoId: string;
  vehiculo: string;
  aseguradoraId: string;
  aseguradora: string;
  numero: string;
  fechaExpedicion: string;
  fechaEfectividad: string;
  fechaVencimiento: string;
  cobertura: Cobertura;
  diasRestantes: number;
}

export interface DatosPoliza {
  vehiculoId: string;
  aseguradoraId: string;
  numero: string;
  fechaExpedicion: string;
  fechaEfectividad: string;
  fechaVencimiento: string;
}

export interface FiltroPolizas {
  pagina: number;
  tamano: number;
  busqueda: string;
}

export const NOMBRE_COBERTURA: Record<Cobertura, string> = {
  Vigente: 'Vigente',
  PorVencer: 'Por vencer',
  Vencida: 'Vencida',
};

/** Los formularios muestran los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

/** Pólizas de seguro. No se eliminan: al renovar se registra una nueva. */
@Injectable({ providedIn: 'root' })
export class PolizasService {
  private readonly http = inject(HttpClient);

  listar(filtro: FiltroPolizas): Observable<Paginado<PolizaResumen>> {
    let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
    if (filtro.busqueda) params = params.set('param', filtro.busqueda);
    return this.http.get<Paginado<PolizaResumen>>(api('polizas'), { params });
  }

  obtener(id: string): Observable<PolizaDetalle> {
    return this.http.get<PolizaDetalle>(api(`polizas/${id}`));
  }

  crear(datos: DatosPoliza): Observable<string> {
    return this.http.post<string>(api('polizas'), datos, SIN_AVISO);
  }

  actualizar(id: string, datos: DatosPoliza): Observable<void> {
    return this.http.put<void>(api(`polizas/${id}`), datos, SIN_AVISO);
  }
}

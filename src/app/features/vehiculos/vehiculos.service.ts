import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';

export interface VehiculoResumen {
  id: string;
  chasis: string;
  matricula: string;
  placa: string;
  marca: string;
  modelo: string;
  fabricacion: number;
  color: string;
  tipo: string;
  disponible: boolean;
}

export interface VehiculoDetalle {
  id: string;
  chasis: string;
  matricula: string;
  placa: string;
  fabricacion: number;
  marcaId: string;
  marca: string;
  modeloId: string;
  modelo: string;
  tipoId: string;
  tipo: string;
  colorId: string;
  color: string;
  disponible: boolean;
}

export interface DatosVehiculo {
  chasis: string;
  matricula: string;
  placa: string;
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

/** Los formularios muestran los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

/** Flota de vehículos. No se eliminan: se marcan fuera de servicio. */
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

  /** `disponible: false` deja el vehículo fuera de servicio. */
  actualizar(id: string, datos: DatosVehiculo & { disponible: boolean }): Observable<void> {
    return this.http.put<void>(api(`vehiculos/${id}`), datos, SIN_AVISO);
  }
}

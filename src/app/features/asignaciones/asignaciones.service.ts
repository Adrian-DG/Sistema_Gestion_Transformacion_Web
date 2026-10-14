import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';
import { ElementoCatalogo } from '../../core/catalogos/catalogos.service';

export type EstatusAsignacion = 'Pendiente' | 'Aprobada' | 'Cancelada' | 'Rechazada' | 'Finalizada';

export const ESTATUS_ASIGNACION: EstatusAsignacion[] = [
  'Pendiente',
  'Aprobada',
  'Finalizada',
  'Rechazada',
  'Cancelada',
];

/** Espejo de TipoBeneficiario del backend. */
export const TIPO_ASIGNACION = { Cargo: 1, Persona: 2 } as const;

export interface AsignacionResumen {
  id: string;
  estatus: EstatusAsignacion;
  solicitante: string;
  solicitanteCedula: string;
  rangoSolicitante: string | null;
  cargoSolicitante: string;
  dependenciaSolicitante: string;
  tipoAsignacion: 'Cargo' | 'Persona';
  asignadoA: string;
  asignadoACedula: string;
  codCargo: number | null;
  cargo: string | null;
  chofer: string;
  choferCedula: string;
  rangoChofer: string | null;
  proposito: string;
  destino: string | null;
  vehiculoId: string;
  chasis: string;
  placa: string;
  matricula: string;
  marca: string;
  modelo: string;
  fechaSalida: string;
  fechaRetornoEstimada: string;
  fechaRetornoReal: string | null;
  motivoRechazoCancelacion: string | null;
  cantidadAdjuntos: number;
}

export interface AdjuntoNuevo {
  tipoDocumentoId: string;
  nombreArchivo: string;
  contentType: string;
  fileBase64: string;
}

/** Cuerpo de POST api/asignaciones (CreateAsignacionCommand). Fechas en hora local, sin zona. */
export interface NuevaAsignacion {
  solicitantePersonaId: string;
  codCargoSolicitante: number | null;
  cargoSolicitante: string;
  codDependenciaSolicitante: number | null;
  dependenciaSolicitante: string;
  tipoAsignacion: number;
  personaId: string;
  codCargo: number | null;
  cargo: string | null;
  choferPersonaId: string;
  vehiculoId: string;
  proposito: string;
  destino: string | null;
  fechaSalida: string;
  fechaRetornoEstimada: string;
  adjuntos: AdjuntoNuevo[];
}

export interface FiltroAsignaciones {
  pagina: number;
  tamano: number;
  busqueda: string;
  estatus: EstatusAsignacion | null;
}

/** El formulario muestra los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

/** Solicitudes de vehículo. No se eliminan: se rechazan o cancelan con un motivo. */
@Injectable({ providedIn: 'root' })
export class AsignacionesService {
  private readonly http = inject(HttpClient);

  listar(filtro: FiltroAsignaciones): Observable<Paginado<AsignacionResumen>> {
    let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
    if (filtro.busqueda) params = params.set('param', filtro.busqueda);
    if (filtro.estatus) params = params.set('estatus', filtro.estatus);
    return this.http.get<Paginado<AsignacionResumen>>(api('asignaciones'), { params });
  }

  /** Vehículos en servicio sin asignaciones aprobadas que choquen con el período. */
  vehiculosDisponibles(salida: string, retornoEstimado: string): Observable<ElementoCatalogo[]> {
    return this.http.get<ElementoCatalogo[]>(api('asignaciones/vehiculos-disponibles'), {
      params: new HttpParams().set('salida', salida).set('retornoEstimado', retornoEstimado),
    });
  }

  crear(asignacion: NuevaAsignacion): Observable<string> {
    return this.http.post<string>(api('asignaciones'), asignacion, SIN_AVISO);
  }

  aprobar(id: string): Observable<void> {
    return this.http.post<void>(api(`asignaciones/${id}/aprobar`), null);
  }

  rechazar(id: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`asignaciones/${id}/rechazar`), { motivo });
  }

  cancelar(id: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`asignaciones/${id}/cancelar`), { motivo });
  }

  /** Registra la entrada del vehículo y finaliza la asignación. */
  registrarRetorno(id: string, fechaRetorno: string): Observable<void> {
    return this.http.post<void>(api(`asignaciones/${id}/retorno`), { fechaRetorno });
  }
}

import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';
import { AdjuntoNuevo } from '../asignaciones/asignaciones.service';

export type EstatusSolicitudTicket = 'Pendiente' | 'Aprobada' | 'Cancelada' | 'Rechazada';
export type EstatusTicket = 'Reservado' | 'Disponible' | 'Utilizado' | 'Anulado';

export const ESTATUS_SOLICITUD_TICKET: EstatusSolicitudTicket[] = [
  'Pendiente',
  'Aprobada',
  'Rechazada',
  'Cancelada',
];

/** Espejo de TipoCombustible del backend. */
export const TIPO_COMBUSTIBLE = { Gasolina: 1, Gasoil: 2 } as const;
export type TipoCombustible = (typeof TIPO_COMBUSTIBLE)[keyof typeof TIPO_COMBUSTIBLE];
export const NOMBRE_COMBUSTIBLE: Record<TipoCombustible, string> = { 1: 'Gasolina', 2: 'Gasoil' };

/** Espejo de TipoBeneficiario del backend. */
export const TIPO_BENEFICIARIO = { Cargo: 1, Persona: 2 } as const;

export interface Existencia {
  tipoCombustible: TipoCombustible;
  /** Entradas menos salidas registradas. */
  existencia: number;
  /** Galones en tickets aprobados que aún no se han utilizado. */
  comprometidoEnTickets: number;
  /** Lo que se puede comprometer en nuevos tickets o despachar. */
  disponibleParaDespacho: number;
}

export interface Ticket {
  id: string;
  numero: string;
  tipoCombustible: 'Gasolina' | 'Gasoil';
  galones: number;
  estatus: EstatusTicket;
  fechaUso: string | null;
}

export interface SolicitudTicketResumen {
  id: string;
  estatus: EstatusSolicitudTicket;
  tipoBeneficiario: 'Cargo' | 'Persona';
  entregadoA: string | null;
  entregadoACedula: string | null;
  solicitante: string;
  solicitanteCedula: string;
  cargoSolicitante: string;
  dependenciaSolicitante: string;
  proposito: string;
  fechaSolicitud: string;
  fechaAprobacion: string | null;
  motivoRechazoCancelacion: string | null;
  totalGalones: number;
  tickets: Ticket[];
}

/** Cuerpo de POST api/combustible/solicitudes-ticket. Los números de ticket los genera la API. */
export interface NuevaSolicitudTicket {
  tipoBeneficiario: number;
  codCargo: number | null;
  cargo: string | null;
  personaId: string | null;
  solicitantePersonaId: string;
  codCargoSolicitante: number | null;
  cargoSolicitante: string;
  codDependenciaSolicitante: number | null;
  dependenciaSolicitante: string;
  proposito: string;
  tickets: { tipoCombustible: TipoCombustible; galones: number; cantidad: number }[];
  adjuntos: AdjuntoNuevo[];
}

export interface SolicitudTicketCreada {
  id: string;
  /** Números asignados, en orden. */
  numeros: string[];
}

export interface FiltroSolicitudesTicket {
  pagina: number;
  tamano: number;
  busqueda: string;
  estatus: EstatusSolicitudTicket | null;
}

/** El formulario muestra los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

/** Existencia de combustible y solicitudes de tickets. Las solicitudes no se eliminan. */
@Injectable({ providedIn: 'root' })
export class CombustibleService {
  private readonly http = inject(HttpClient);

  existencia(): Observable<Existencia[]> {
    return this.http.get<Existencia[]>(api('combustible/existencia'));
  }

  listarSolicitudes(filtro: FiltroSolicitudesTicket): Observable<Paginado<SolicitudTicketResumen>> {
    let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
    if (filtro.busqueda) params = params.set('param', filtro.busqueda);
    if (filtro.estatus) params = params.set('estatus', filtro.estatus);
    return this.http.get<Paginado<SolicitudTicketResumen>>(api('combustible/solicitudes-ticket'), {
      params,
    });
  }

  /** Número que recibiría el próximo ticket; referencial hasta registrar la solicitud. */
  siguienteNumero(): Observable<string> {
    return this.http.get<string>(api('combustible/tickets/siguiente-numero'), SIN_AVISO);
  }

  crearSolicitud(solicitud: NuevaSolicitudTicket): Observable<SolicitudTicketCreada> {
    return this.http.post<SolicitudTicketCreada>(
      api('combustible/solicitudes-ticket'),
      solicitud,
      SIN_AVISO,
    );
  }

  /** Los tickets pasan a Disponible y comprometen la existencia. */
  aprobar(id: string): Observable<void> {
    return this.http.post<void>(api(`combustible/solicitudes-ticket/${id}/aprobar`), null);
  }

  rechazar(id: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`combustible/solicitudes-ticket/${id}/rechazar`), { motivo });
  }

  cancelar(id: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`combustible/solicitudes-ticket/${id}/cancelar`), { motivo });
  }
}

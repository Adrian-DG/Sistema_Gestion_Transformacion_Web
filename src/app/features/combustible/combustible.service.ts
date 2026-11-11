import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';
import { ElementoCatalogo } from '../../core/catalogos/catalogos.service';
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

/** Ticket leído en el despacho. */
export interface TicketDespacho {
  id: string;
  numero: string;
  tipoCombustible: 'Gasolina' | 'Gasoil';
  galones: number;
  estatus: EstatusTicket;
  entregadoA: string | null;
  proposito: string | null;
  /** Se escribió solo el número: falta el código de verificación impreso en el ticket. */
  requiereCodigoVerificacion: boolean;
  fechaUso: string | null;
  despachadoPor: string | null;
  receptorNombre: string | null;
}

/** Ticket despachado: fecha y hora del servidor y operador que lo despachó. */
export interface DespachoTicket {
  movimientoId: string;
  numero: string;
  tipoCombustible: 'Gasolina' | 'Gasoil';
  galones: number;
  fechaUso: string;
  entregadoA: string | null;
  receptorNombre: string | null;
  despachadoPor: string | null;
}

/**
 * Lo leído por un lector configurado con otra distribución de teclado puede traer otros separadores
 * (ej. "TC'2026'000001'K7QX3M"): se normaliza a mayúsculas con guiones.
 */
export function normalizarCodigoTicket(texto: string): string {
  return texto
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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

/** Ticket de una solicitud con los datos de su uso. */
export interface TicketDetalle extends Ticket {
  despachadoPor: string | null;
  receptorNombre: string | null;
}

/** Totales de una solicitud por tipo de combustible. */
export interface ResumenCombustible {
  tipoCombustible: 'Gasolina' | 'Gasoil';
  tickets: number;
  galones: number;
  ticketsUtilizados: number;
  galonesUtilizados: number;
  /** Disponibles o reservados: aún pueden canjearse. */
  ticketsPendientes: number;
  galonesPendientes: number;
  ticketsAnulados: number;
}

export interface AdjuntoSolicitudTicket {
  id: string;
  nombreArchivo: string;
  contentType: string;
  tipoDocumento: string | null;
}

/** GET api/combustible/solicitudes-ticket/{id}. */
export interface SolicitudTicketDetalle extends Omit<SolicitudTicketResumen, 'tickets'> {
  entregadoARango: string | null;
  registradoPor: string | null;
  aprobadoPor: string | null;
  galonesUtilizados: number;
  resumen: ResumenCombustible[];
  tickets: TicketDetalle[];
  adjuntos: AdjuntoSolicitudTicket[];
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

/** Cuerpo de POST api/combustible/compras (RegistrarCompraCommand): entrada de combustible al depósito. */
export interface NuevaEntradaCombustible {
  tipoCombustible: TipoCombustible;
  galones: number;
  /** Fecha y hora local de la recepción, sin zona; nula = ahora. */
  fecha: string | null;
  /** Suplidor registrado en el sistema. */
  proveedorId: string;
  numeroFactura: string | null;
  observacion: string | null;
  adjuntos: AdjuntoNuevo[];
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

  /** Suplidores activos registrados en el sistema. */
  proveedores(): Observable<ElementoCatalogo[]> {
    return this.http.get<ElementoCatalogo[]>(api('combustible/proveedores'));
  }

  /** Registra la recepción de combustible; suma a la existencia del tipo indicado. */
  registrarEntrada(entrada: NuevaEntradaCombustible): Observable<string> {
    return this.http.post<string>(api('combustible/compras'), entrada, SIN_AVISO);
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
  /** Detalle de la solicitud con cada ticket y su uso. */
  solicitud(id: string): Observable<SolicitudTicketDetalle> {
    return this.http.get<SolicitudTicketDetalle>(api(`combustible/solicitudes-ticket/${id}`));
  }

  adjunto(id: string): Observable<Blob> {
    return this.http.get(api(`combustible/adjuntos/${id}`), { responseType: 'blob' });
  }

  aprobar(id: string): Observable<void> {
    return this.http.post<void>(api(`combustible/solicitudes-ticket/${id}/aprobar`), null);
  }

  rechazar(id: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`combustible/solicitudes-ticket/${id}/rechazar`), { motivo });
  }

  cancelar(id: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`combustible/solicitudes-ticket/${id}/cancelar`), { motivo });
  }

  /** PDF con los tickets disponibles de una solicitud aprobada, con su código de barras. */
  imprimirTickets(id: string): Observable<Blob> {
    return this.http.get(api(`combustible/solicitudes-ticket/${id}/tickets-pdf`), {
      responseType: 'blob',
    });
  }

  // Despacho

  /** Ticket por lo escaneado (número y código de verificación) o por su número escrito. */
  ticketDespacho(codigo: string): Observable<TicketDespacho> {
    return this.http.get<TicketDespacho>(api('combustible/tickets/despacho'), {
      params: new HttpParams().set('codigo', normalizarCodigoTicket(codigo)),
      ...SIN_AVISO,
    });
  }

  /** Despacha el ticket: la API registra la fecha y hora y el operador. */
  despachar(codigo: string, receptorNombre: string | null): Observable<DespachoTicket> {
    return this.http.post<DespachoTicket>(
      api('combustible/tickets/despachar'),
      { codigo: normalizarCodigoTicket(codigo), receptorNombre },
      SIN_AVISO,
    );
  }

  /** Tickets despachados hoy, el más reciente primero. */
  despachosDeHoy(): Observable<DespachoTicket[]> {
    return this.http.get<DespachoTicket[]>(api('combustible/despachos-ticket'));
  }
}

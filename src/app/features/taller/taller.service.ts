import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';
import { ElementoCatalogo } from '../../core/catalogos/catalogos.service';
import { AdjuntoNuevo, AdjuntoResumen } from '../inventario/inventario.service';

/** Espejo de TipoSolicitudTaller (la API recibe el número y devuelve el nombre). */
export const TIPOS_SOLICITUD = [
  { valor: 1, codigo: 'Mantenimiento', nombre: 'Mantenimiento' },
  { valor: 2, codigo: 'Reparacion', nombre: 'Reparación' },
  { valor: 3, codigo: 'EvaluacionBaja', nombre: 'Evaluación de baja' },
] as const;

export type TipoSolicitud = (typeof TIPOS_SOLICITUD)[number]['codigo'];

/** Espejo de EstatusSolicitudTaller. */
export const ESTATUS_SOLICITUD = [
  { valor: 0, codigo: 'Pendiente', nombre: 'Pendiente' },
  { valor: 1, codigo: 'EnTaller', nombre: 'En taller' },
  { valor: 2, codigo: 'Finalizada', nombre: 'Finalizada' },
  { valor: 3, codigo: 'Cancelada', nombre: 'Cancelada' },
  { valor: 4, codigo: 'Rechazada', nombre: 'Rechazada' },
] as const;

export type EstatusSolicitudTaller = (typeof ESTATUS_SOLICITUD)[number]['codigo'];

export const nombreTipo = (codigo: string): string =>
  TIPOS_SOLICITUD.find((t) => t.codigo === codigo)?.nombre ?? codigo;

export const nombreEstatus = (codigo: string): string =>
  ESTATUS_SOLICITUD.find((e) => e.codigo === codigo)?.nombre ?? codigo;

/** Espejo de LugarMantenimiento. */
export const LUGARES = [
  { valor: 1, codigo: 'Interno', nombre: 'Taller de la institución' },
  { valor: 2, codigo: 'Externo', nombre: 'Taller autorizado (externo)' },
] as const;

export type LugarMantenimiento = (typeof LUGARES)[number]['codigo'];

export interface SolicitudTaller {
  id: string;
  numero: string;
  tipo: TipoSolicitud;
  estatus: EstatusSolicitudTaller;
  vehiculoId: string;
  placa: string;
  ficha: string | null;
  vehiculo: string;
  solicitante: string;
  solicitanteCedula: string;
  motivo: string;
  kilometraje: number;
  fechaSolicitud: string;
  mecanicoId: string | null;
  mecanico: string | null;
  fechaIngreso: string | null;
  fechaSalida: string | null;
  diagnostico: string | null;
  trabajoRealizado: string | null;
  procedeBaja: boolean;
  motivoRechazoCancelacion: string | null;
  costoPiezas: number;
  lugar: LugarMantenimiento;
  tallerExternoId: string | null;
  tallerExterno: string | null;
  /** Lo que cobró el taller autorizado. */
  costoServicio: number | null;
  numeroFacturaServicio: string | null;
  /** Piezas más servicio externo. */
  costoTotal: number;
}

/** Kilometraje y garantía del vehículo (api/taller/vehiculos/{id}/garantia). */
export interface GarantiaVehiculo {
  vehiculoId: string;
  placa: string;
  kilometraje: number;
  enGarantia: boolean;
  garantiaVence: string | null;
  garantiaKilometraje: number | null;
  garantiaTallerId: string | null;
  garantiaTaller: string | null;
}

export interface PiezaUtilizada {
  piezaId: string;
  codigo: string;
  pieza: string;
  unidadMedida: string;
  cantidad: number;
  costoUnitario: number;
  origen: 'Inventario' | 'CompraDirecta';
  fecha: string;
}

export interface CompraDirecta {
  id: string;
  codigo: string;
  pieza: string;
  cantidad: number;
  costoUnitario: number;
  proveedor: string;
  numeroFactura: string | null;
  fecha: string;
  recibos: AdjuntoResumen[];
}

export interface SolicitudTallerDetalle {
  solicitud: SolicitudTaller;
  piezas: PiezaUtilizada[];
  compras: CompraDirecta[];
  devoluciones: PiezaUtilizada[];
  /** Factura u orden de servicio del taller autorizado. */
  adjuntosServicio: AdjuntoResumen[];
}

export interface HistorialMantenimientos {
  solicitudes: { solicitud: SolicitudTaller; piezas: PiezaUtilizada[] }[];
  reactivaciones: { id: string; fecha: string; motivo: string; autorizadoPor: string }[];
}

export interface FiltroSolicitudes {
  pagina: number;
  tamano: number;
  busqueda: string;
  estatus: number | null;
  tipo: number | null;
}

export interface NuevaSolicitudTaller {
  vehiculoId: string;
  tipo: number;
  solicitantePersonaId: string;
  motivo: string;
  kilometraje: number;
  lugar: number;
  tallerExternoId: string | null;
}

export interface CompraPieza {
  proveedorId: string;
  costoUnitario: number;
  numeroFactura: string | null;
  recibo: AdjuntoNuevo;
}

export interface ServicioExterno {
  costoServicio: number;
  numeroFacturaServicio: string | null;
  adjuntos: AdjuntoNuevo[];
}

export interface Mecanico {
  id: string;
  personaId: string;
  identificacion: string;
  nombreCompleto: string;
  tipoPersona: 'Militar' | 'Asimilado' | 'Civil';
  rango: string | null;
  telefono: string | null;
  especialidad: string | null;
  activo: boolean;
  solicitudesEnTaller: number;
}

export interface MecanicoCivil {
  identificacion: string;
  nombre: string;
  apellido: string;
  sexo: number;
  telefono: string | null;
}

/** Código del error cuando faltan piezas en inventario y no se indicó la compra. */
export const CODIGO_COMPRA_REQUERIDA = 'Taller.CompraRequerida';

/** Los formularios muestran los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

/** Solicitudes de taller, mecánicos y reactivación de vehículos. */
@Injectable({ providedIn: 'root' })
export class TallerService {
  private readonly http = inject(HttpClient);

  solicitudes(filtro: FiltroSolicitudes): Observable<Paginado<SolicitudTaller>> {
    let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
    if (filtro.busqueda) params = params.set('param', filtro.busqueda);
    if (filtro.estatus !== null) params = params.set('estatus', filtro.estatus);
    if (filtro.tipo !== null) params = params.set('tipo', filtro.tipo);
    return this.http.get<Paginado<SolicitudTaller>>(api('taller/solicitudes'), { params });
  }

  solicitud(id: string): Observable<SolicitudTallerDetalle> {
    return this.http.get<SolicitudTallerDetalle>(api(`taller/solicitudes/${id}`));
  }

  crear(solicitud: NuevaSolicitudTaller): Observable<{ id: string; numero: string }> {
    return this.http.post<{ id: string; numero: string }>(
      api('taller/solicitudes'),
      solicitud,
      SIN_AVISO,
    );
  }

  /**
   * Devuelve cuántas asignaciones aprobadas a futuro tiene el vehículo. El mecánico solo en el
   * taller interno.
   */
  ingresar(
    id: string,
    mecanicoId: string | null,
    kilometraje: number,
  ): Observable<{ asignacionesAprobadas: number }> {
    return this.http.post<{ asignacionesAprobadas: number }>(
      api(`taller/solicitudes/${id}/ingresar`),
      { mecanicoId, kilometraje },
    );
  }

  /** Sin compra y sin existencia suficiente responde {@link CODIGO_COMPRA_REQUERIDA}. */
  agregarPieza(
    id: string,
    piezaId: string,
    cantidad: number,
    compra: CompraPieza | null,
  ): Observable<{ delInventario: number; compradas: number }> {
    return this.http.post<{ delInventario: number; compradas: number }>(
      api(`taller/solicitudes/${id}/piezas`),
      { piezaId, cantidad, compra },
      SIN_AVISO,
    );
  }

  /** En una solicitud externa, `servicio` con lo que cobró el taller autorizado. */
  finalizar(
    id: string,
    diagnostico: string,
    trabajoRealizado: string,
    procedeBaja: boolean,
    servicio: ServicioExterno | null = null,
  ): Observable<void> {
    return this.http.post<void>(
      api(`taller/solicitudes/${id}/finalizar`),
      { diagnostico, trabajoRealizado, procedeBaja, ...servicio },
      SIN_AVISO,
    );
  }

  /** Kilometraje y garantía del vehículo, para elegir el taller interno o el autorizado. */
  garantia(vehiculoId: string): Observable<GarantiaVehiculo> {
    return this.http.get<GarantiaVehiculo>(api(`taller/vehiculos/${vehiculoId}/garantia`));
  }

  rechazar(id: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`taller/solicitudes/${id}/rechazar`), { motivo });
  }

  cancelar(id: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`taller/solicitudes/${id}/cancelar`), { motivo });
  }

  mecanicos(filtro: {
    pagina: number;
    tamano: number;
    busqueda: string;
  }): Observable<Paginado<Mecanico>> {
    let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
    if (filtro.busqueda) params = params.set('param', filtro.busqueda);
    return this.http.get<Paginado<Mecanico>>(api('taller/mecanicos'), { params });
  }

  /** Mecánicos activos. */
  catalogoMecanicos(): Observable<ElementoCatalogo[]> {
    return this.http.get<ElementoCatalogo[]>(api('taller/mecanicos/catalogo'));
  }

  mecanico(id: string): Observable<Mecanico> {
    return this.http.get<Mecanico>(api(`taller/mecanicos/${id}`));
  }

  /** Militar: `personaId` importado de SIPFFAA. Civil: `civil` con sus datos. */
  crearMecanico(datos: {
    personaId: string | null;
    civil: MecanicoCivil | null;
    especialidad: string | null;
  }): Observable<string> {
    return this.http.post<string>(api('taller/mecanicos'), datos, SIN_AVISO);
  }

  actualizarMecanico(
    id: string,
    datos: { especialidad: string | null; telefono: string | null; activo: boolean },
  ): Observable<void> {
    return this.http.put<void>(api(`taller/mecanicos/${id}`), datos, SIN_AVISO);
  }

  historial(vehiculoId: string): Observable<HistorialMantenimientos> {
    return this.http.get<HistorialMantenimientos>(api(`vehiculos/${vehiculoId}/mantenimientos`));
  }

  /** Reactivación excepcional de un vehículo dado de baja. */
  reactivarVehiculo(vehiculoId: string, motivo: string): Observable<void> {
    return this.http.post<void>(api(`taller/vehiculos/${vehiculoId}/reactivar`), { motivo });
  }
}

import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SIN_AVISO_ERROR, api } from '../api/api';

/**
 * Dónde se encontró el resultado: Historico (ya registrado en el sistema: personas, asignaciones,
 * tickets) o Sipffaa. Las búsquedas consultan primero el histórico y, si no hay coincidencias, SIPFFAA.
 */
export type OrigenBusqueda = 'Historico' | 'Sipffaa';

/**
 * Miembro devuelto por api/externos/miembros. Si viene del histórico (persona ya registrada) no trae
 * codMiembro ni los datos propios de SIPFFAA; su cargo es el último con que hizo una solicitud.
 */
export interface MiembroSipffaa {
  origen: OrigenBusqueda;
  codMiembro: number;
  cedula: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  nombreCompleto: string;
  sexo: string | null;
  esMilitar: boolean;
  codInstitucion: number;
  siglasInstitucion: string | null;
  institucion: string | null;
  codRango: number;
  rango: string | null;
  rangoAbreviado: string | null;
  codDepartamento: number;
  departamento: string | null;
  codCargo: number;
  cargo: string | null;
  descripcionCargo: string | null;
  estadoMiembro: string | null;
  licenciaConducir: string | null;
  noCarnet: string | null;
  status: boolean;
}

export interface DepartamentoSipffaa {
  origen: OrigenBusqueda;
  codDepartamento: number;
  nombre: string;
  descripcion: string | null;
  codInstitucion: number;
  codigoDeRegistro: string | null;
  codDptoPadre: number;
  departamentoPadre: string | null;
  estaEnElRecintoMilitar: boolean;
  status: boolean;
}

export interface OcupanteCargoSipffaa {
  codCargo: number;
  codMiembro: number;
  cedula: string;
  nombreCompleto: string;
  rango: string | null;
  departamento: string | null;
}

/** Un cargo del histórico no trae sus ocupantes. */
export interface CargoSipffaa {
  origen: OrigenBusqueda;
  codCargo: number;
  nombre: string;
  descripcion: string | null;
  codInstitucion: number;
  esEncargado: boolean;
  esUnica: boolean | null;
  cantidadOcupantes: number;
  ocupantes: OcupanteCargoSipffaa[];
}

/** El buscador muestra su propio mensaje si SIPFFAA no responde. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

/** Parámetros comunes; con soloSipffaa se omite el histórico y se consulta SIPFFAA directamente. */
function parametros(
  campo: string,
  texto: string,
  maximo: number,
  soloSipffaa: boolean,
): HttpParams {
  let params = new HttpParams().set(campo, texto).set('maxResultados', maximo);
  if (soloSipffaa) params = params.set('soloSipffaa', true);
  return params;
}

/**
 * Búsqueda de personal, departamentos y cargos a través de la API: primero en el histórico del
 * sistema y, si no hay coincidencias (o con soloSipffaa), en SIPFFAA.
 */
@Injectable({ providedIn: 'root' })
export class SipffaaService {
  private readonly http = inject(HttpClient);

  /** Por inicio de cédula (si el texto son dígitos) o por nombre. */
  buscarMiembros(texto: string, maximo = 10, soloSipffaa = false): Observable<MiembroSipffaa[]> {
    return this.http.get<MiembroSipffaa[]>(api('externos/miembros'), {
      params: parametros('texto', texto, maximo, soloSipffaa),
      ...SIN_AVISO,
    });
  }

  buscarDepartamentos(
    nombre: string,
    maximo = 10,
    soloSipffaa = false,
  ): Observable<DepartamentoSipffaa[]> {
    return this.http.get<DepartamentoSipffaa[]>(api('externos/departamentos'), {
      params: parametros('nombre', nombre, maximo, soloSipffaa),
      ...SIN_AVISO,
    });
  }

  buscarCargos(nombre: string, maximo = 10, soloSipffaa = false): Observable<CargoSipffaa[]> {
    return this.http.get<CargoSipffaa[]>(api('externos/cargos'), {
      params: parametros('nombre', nombre, maximo, soloSipffaa),
      ...SIN_AVISO,
    });
  }

  /**
   * Id de la persona del sistema con esa cédula; si no existe, la API la crea con sus datos de SIPFFAA.
   * Las solicitudes (asignaciones, tickets) se registran con este Id.
   */
  importarPersona(cedula: string): Observable<string> {
    return this.http.post<string>(api(`personas/sipffaa/${encodeURIComponent(cedula)}`), null);
  }
}

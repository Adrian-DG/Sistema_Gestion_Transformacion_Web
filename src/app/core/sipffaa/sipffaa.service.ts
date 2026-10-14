import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SIN_AVISO_ERROR, api } from '../api/api';

/** Miembro de SIPFFAA (vista de miembros), devuelto por api/externos/miembros. */
export interface MiembroSipffaa {
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

export interface CargoSipffaa {
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

/** Consultas de solo lectura a SIPFFAA (personal, departamentos y cargos) a través de la API. */
@Injectable({ providedIn: 'root' })
export class SipffaaService {
  private readonly http = inject(HttpClient);

  /** Por inicio de cédula (si el texto son dígitos) o por nombre. */
  buscarMiembros(texto: string, maximo = 10): Observable<MiembroSipffaa[]> {
    return this.http.get<MiembroSipffaa[]>(api('externos/miembros'), {
      params: new HttpParams().set('texto', texto).set('maxResultados', maximo),
      ...SIN_AVISO,
    });
  }

  buscarDepartamentos(nombre: string, maximo = 10): Observable<DepartamentoSipffaa[]> {
    return this.http.get<DepartamentoSipffaa[]>(api('externos/departamentos'), {
      params: new HttpParams().set('nombre', nombre).set('maxResultados', maximo),
      ...SIN_AVISO,
    });
  }

  buscarCargos(nombre: string, maximo = 10): Observable<CargoSipffaa[]> {
    return this.http.get<CargoSipffaa[]>(api('externos/cargos'), {
      params: new HttpParams().set('nombre', nombre).set('maxResultados', maximo),
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

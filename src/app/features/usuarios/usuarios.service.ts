import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';

export interface UsuarioResumen {
  id: string;
  userName: string;
  nombreCompleto: string;
  identificacion: string;
  email: string | null;
  institucion: string;
  rango: string | null;
  activo: boolean;
  roles: string[];
}

export interface UsuarioDetalle {
  id: string;
  userName: string;
  email: string | null;
  telefono: string | null;
  identificacion: string;
  nombre: string;
  apellido: string;
  sexo: string;
  institucion: string;
  rangoId: string | null;
  rango: string | null;
  activo: boolean;
  fechaCreacion: string;
  roles: string[];
}

export interface PermisoDisponible {
  nombre: string;
  descripcion: string | null;
}

/** Datos editables; Sexo e Institución van como número (enums del backend). */
export interface DatosUsuario {
  userName: string;
  email: string;
  telefono: string | null;
  identificacion: string;
  nombre: string;
  apellido: string;
  sexo: number;
  institucion: number;
  rangoId: string | null;
}

export interface NuevoUsuario extends DatosUsuario {
  password: string;
  roles: string[];
}

export interface FiltroUsuarios {
  pagina: number;
  tamano: number;
  busqueda: string;
  /** null = todos. */
  activo: boolean | null;
}

/** Los formularios muestran los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  listar(filtro: FiltroUsuarios): Observable<Paginado<UsuarioResumen>> {
    let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
    if (filtro.busqueda) params = params.set('param', filtro.busqueda);
    if (filtro.activo !== null) params = params.set('activo', filtro.activo);

    return this.http.get<Paginado<UsuarioResumen>>(api('usuarios'), { params });
  }

  obtener(id: string): Observable<UsuarioDetalle> {
    return this.http.get<UsuarioDetalle>(api(`usuarios/${id}`));
  }

  permisos(): Observable<PermisoDisponible[]> {
    return this.http.get<PermisoDisponible[]>(api('usuarios/roles'));
  }

  crear(usuario: NuevoUsuario): Observable<string> {
    return this.http.post<string>(api('usuarios'), usuario, SIN_AVISO);
  }

  actualizar(id: string, datos: DatosUsuario): Observable<void> {
    return this.http.put<void>(api(`usuarios/${id}`), datos, SIN_AVISO);
  }

  asignarPermisos(id: string, roles: string[]): Observable<void> {
    return this.http.put<void>(api(`usuarios/${id}/roles`), { roles });
  }

  cambiarEstado(id: string, activo: boolean): Observable<void> {
    return this.http.post<void>(api(`usuarios/${id}/${activo ? 'activar' : 'desactivar'}`), null);
  }
}

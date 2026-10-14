import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SIN_AVISO_ERROR, api } from '../../core/api/api';

export interface AparienciaDetalle {
  id: string;
  nombre: string;
  descripcion: string | null;
  esActiva: boolean;
  nombreSistema: string;
  nombreCorto: string | null;
  nombreInstitucion: string | null;
  tieneLogo: boolean;
  logoNombreArchivo: string | null;
  colorPrimario: string;
  colorSecundario: string;
  colorBotonPrimario: string;
  colorBotonSecundario: string;
  colorBotonPeligro: string;
  version: number;
  actualizadoEn: string;
}

export interface DatosApariencia {
  nombre: string;
  descripcion: string | null;
  nombreSistema: string;
  nombreCorto: string | null;
  nombreInstitucion: string | null;
  colorPrimario: string;
  colorSecundario: string;
  colorBotonPrimario: string;
  colorBotonSecundario: string;
  colorBotonPeligro: string;
}

export interface LogoNuevo {
  nombreArchivo: string;
  fileBase64: string;
}

/** Los formularios muestran los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

/** Administración de apariencias (solo Administrador). No se eliminan: se activa otra. */
@Injectable({ providedIn: 'root' })
export class AparienciasService {
  private readonly http = inject(HttpClient);

  listar(): Observable<AparienciaDetalle[]> {
    return this.http.get<AparienciaDetalle[]>(api('configuracion/apariencias'));
  }

  obtener(id: string): Observable<AparienciaDetalle> {
    return this.http.get<AparienciaDetalle>(api(`configuracion/apariencias/${id}`));
  }

  crear(datos: DatosApariencia): Observable<string> {
    return this.http.post<string>(api('configuracion/apariencias'), datos, SIN_AVISO);
  }

  actualizar(id: string, datos: DatosApariencia): Observable<AparienciaDetalle> {
    return this.http.put<AparienciaDetalle>(api(`configuracion/apariencias/${id}`), datos, SIN_AVISO);
  }

  duplicar(id: string, nombre: string): Observable<string> {
    return this.http.post<string>(api(`configuracion/apariencias/${id}/duplicar`), { nombre });
  }

  activar(id: string): Observable<void> {
    return this.http.post<void>(api(`configuracion/apariencias/${id}/activar`), null);
  }

  /** La imagen requiere el token, por eso se descarga como Blob y no con un `<img src>`. */
  logo(id: string): Observable<Blob> {
    return this.http.get(api(`configuracion/apariencias/${id}/logo`), {
      responseType: 'blob',
      context: new HttpContext().set(SIN_AVISO_ERROR, true),
    });
  }

  subirLogo(id: string, logo: LogoNuevo): Observable<AparienciaDetalle> {
    return this.http.put<AparienciaDetalle>(api(`configuracion/apariencias/${id}/logo`), logo);
  }

  quitarLogo(id: string): Observable<AparienciaDetalle> {
    return this.http.delete<AparienciaDetalle>(api(`configuracion/apariencias/${id}/logo`));
  }
}

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { ApiError, SIN_AVISO_ERROR, esUrlApi } from '../api/api';
import { AuthService } from '../auth/auth.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/** Agrega el token a las peticiones dirigidas a la API. */
export const tokenInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const token = inject(AuthService).token();
  if (!token || !esUrlApi(peticion.url)) return siguiente(peticion);

  return siguiente(peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/**
 * Convierte las respuestas de error en {@link ApiError} y muestra un aviso, salvo que la petición
 * lleve {@link SIN_AVISO_ERROR}. Un 401 con sesión activa la cierra (token vencido o usuario desactivado).
 */
export const erroresInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const auth = inject(AuthService);
  const notificaciones = inject(NotificacionesService);

  return siguiente(peticion).pipe(
    catchError((respuesta: unknown) => {
      if (!(respuesta instanceof HttpErrorResponse)) return throwError(() => respuesta);

      return from(aApiError(respuesta)).pipe(
        switchMap((error) => {
          if (error.status === 401 && auth.autenticado() && esUrlApi(peticion.url)) {
            auth.cerrarSesion('no-autorizado');
          } else if (!peticion.context.get(SIN_AVISO_ERROR)) {
            notificaciones.error(error.mensaje);
          }

          return throwError(() => error);
        }),
      );
    }),
  );
};

const MENSAJES_POR_ESTADO: Record<number, string> = {
  0: 'No se pudo conectar con el servidor. Verifique su conexión.',
  401: 'Debe iniciar sesión para continuar.',
  403: 'No tiene permiso para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  413: 'El archivo enviado es demasiado grande.',
  500: 'Ocurrió un error inesperado en el servidor.',
};

async function aApiError(respuesta: HttpErrorResponse): Promise<ApiError> {
  let cuerpo: unknown = respuesta.error;

  // Con responseType 'blob' o 'text' el ProblemDetails llega sin interpretar.
  if (cuerpo instanceof Blob) cuerpo = await cuerpo.text();
  if (typeof cuerpo === 'string') {
    try {
      cuerpo = JSON.parse(cuerpo);
    } catch {
      cuerpo = null;
    }
  }

  const problema = (cuerpo ?? {}) as {
    title?: string;
    detail?: string;
    errors?: Record<string, string[]>;
  };

  const errores = problema.errors ?? {};
  const primerErrorCampo = Object.values(errores).flat()[0];
  const mensaje =
    (respuesta.status === 400 && primerErrorCampo) ||
    problema.detail ||
    MENSAJES_POR_ESTADO[respuesta.status] ||
    problema.title ||
    'No se pudo completar la operación.';

  return {
    status: respuesta.status,
    codigo: problema.title ?? `Http.${respuesta.status}`,
    mensaje,
    errores,
  };
}

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Permiso } from './permisos';

/** Exige sesión; si no hay, envía al login recordando la ruta solicitada. */
export const autenticadoGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  if (auth.autenticado()) return true;

  return inject(Router).createUrlTree(['/login'], { queryParams: { retorno: estado.url } });
};

/** Para el login: si ya hay sesión, va al inicio. */
export const invitadoGuard: CanActivateFn = () =>
  inject(AuthService).autenticado() ? inject(Router).createUrlTree(['/inicio']) : true;

/**
 * Exige alguno de los permisos indicados en `data.permisos` de la ruta.
 * Sin permiso, muestra la página de acceso denegado.
 */
export const permisoGuard: CanActivateFn = (ruta) => {
  const requeridos = (ruta.data['permisos'] as Permiso[] | undefined) ?? [];
  return (
    inject(AuthService).tiene(...requeridos) || inject(Router).createUrlTree(['/acceso-denegado'])
  );
};

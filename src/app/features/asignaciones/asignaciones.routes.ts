import { Routes } from '@angular/router';
import { permisoGuard } from '../../core/auth/auth.guards';
import { Permiso } from '../../core/auth/permisos';

export const ASIGNACIONES_ROUTES: Routes = [
  {
    path: '',
    title: 'Asignaciones',
    loadComponent: () => import('./lista/asignaciones-lista').then((m) => m.AsignacionesLista),
  },
  {
    path: 'nueva',
    canActivate: [permisoGuard],
    data: { permisos: [Permiso.GestionAsignaciones] },
    title: 'Nueva asignación',
    loadComponent: () =>
      import('./formulario/asignacion-formulario').then((m) => m.AsignacionFormulario),
  },
];

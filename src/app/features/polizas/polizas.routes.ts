import { Routes } from '@angular/router';
import { permisoGuard } from '../../core/auth/auth.guards';
import { Permiso } from '../../core/auth/permisos';

export const POLIZAS_ROUTES: Routes = [
  {
    path: '',
    title: 'Pólizas',
    loadComponent: () => import('./lista/polizas-lista').then((m) => m.PolizasLista),
  },
  {
    path: 'nueva',
    canActivate: [permisoGuard],
    data: { permisos: [Permiso.GestionPolizas] },
    title: 'Nueva póliza',
    loadComponent: () => import('./formulario/poliza-formulario').then((m) => m.PolizaFormulario),
  },
  {
    path: ':id/editar',
    canActivate: [permisoGuard],
    data: { permisos: [Permiso.GestionPolizas] },
    title: 'Editar póliza',
    loadComponent: () => import('./formulario/poliza-formulario').then((m) => m.PolizaFormulario),
  },
];

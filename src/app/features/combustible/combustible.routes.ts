import { Routes } from '@angular/router';
import { permisoGuard } from '../../core/auth/auth.guards';
import { Permiso } from '../../core/auth/permisos';

export const COMBUSTIBLE_ROUTES: Routes = [
  {
    path: '',
    title: 'Combustible',
    loadComponent: () =>
      import('./lista/solicitudes-ticket-lista').then((m) => m.SolicitudesTicketLista),
  },
  {
    path: 'nueva',
    canActivate: [permisoGuard],
    data: { permisos: [Permiso.GestionCombustible] },
    title: 'Nueva solicitud de tickets',
    loadComponent: () =>
      import('./formulario/solicitud-ticket-formulario').then((m) => m.SolicitudTicketFormulario),
  },
  {
    path: 'entrada',
    canActivate: [permisoGuard],
    data: { permisos: [Permiso.GestionCombustible] },
    title: 'Registrar entrada de combustible',
    loadComponent: () => import('./entrada/entrada-combustible').then((m) => m.EntradaCombustible),
  },
];

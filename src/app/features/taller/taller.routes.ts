import { Routes } from '@angular/router';

export const TALLER_ROUTES: Routes = [
  {
    path: '',
    title: 'Solicitudes de taller',
    loadComponent: () =>
      import('./solicitudes/solicitudes-taller-lista').then((m) => m.SolicitudesTallerLista),
  },
  {
    path: 'nueva',
    title: 'Nueva solicitud de taller',
    loadComponent: () =>
      import('./solicitudes/solicitud-taller-formulario').then((m) => m.SolicitudTallerFormulario),
  },
  {
    path: ':id',
    title: 'Solicitud de taller',
    loadComponent: () =>
      import('./solicitudes/solicitud-taller-detalle').then((m) => m.SolicitudTallerDetalle),
  },
];

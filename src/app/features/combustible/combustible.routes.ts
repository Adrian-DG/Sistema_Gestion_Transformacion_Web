import { Routes } from '@angular/router';

export const COMBUSTIBLE_ROUTES: Routes = [
  {
    path: '',
    title: 'Combustible',
    loadComponent: () =>
      import('./lista/solicitudes-ticket-lista').then((m) => m.SolicitudesTicketLista),
  },
  {
    path: 'nueva',
    title: 'Nueva solicitud de tickets',
    loadComponent: () =>
      import('./formulario/solicitud-ticket-formulario').then((m) => m.SolicitudTicketFormulario),
  },
];

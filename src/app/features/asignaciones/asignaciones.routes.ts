import { Routes } from '@angular/router';

export const ASIGNACIONES_ROUTES: Routes = [
  {
    path: '',
    title: 'Asignaciones',
    loadComponent: () => import('./lista/asignaciones-lista').then((m) => m.AsignacionesLista),
  },
  {
    path: 'nueva',
    title: 'Nueva asignación',
    loadComponent: () =>
      import('./formulario/asignacion-formulario').then((m) => m.AsignacionFormulario),
  },
];

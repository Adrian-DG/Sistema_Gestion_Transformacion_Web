import { Routes } from '@angular/router';

export const APARIENCIA_ROUTES: Routes = [
  {
    path: '',
    title: 'Apariencia',
    loadComponent: () => import('./lista/apariencias-lista').then((m) => m.AparienciasLista),
  },
  {
    path: 'nueva',
    title: 'Nueva apariencia',
    loadComponent: () =>
      import('./formulario/apariencia-formulario').then((m) => m.AparienciaFormulario),
  },
  {
    path: ':id/editar',
    title: 'Editar apariencia',
    loadComponent: () =>
      import('./formulario/apariencia-formulario').then((m) => m.AparienciaFormulario),
  },
];

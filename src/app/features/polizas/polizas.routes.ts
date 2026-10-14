import { Routes } from '@angular/router';

export const POLIZAS_ROUTES: Routes = [
  {
    path: '',
    title: 'Pólizas',
    loadComponent: () => import('./lista/polizas-lista').then((m) => m.PolizasLista),
  },
  {
    path: 'nueva',
    title: 'Nueva póliza',
    loadComponent: () => import('./formulario/poliza-formulario').then((m) => m.PolizaFormulario),
  },
  {
    path: ':id/editar',
    title: 'Editar póliza',
    loadComponent: () => import('./formulario/poliza-formulario').then((m) => m.PolizaFormulario),
  },
];

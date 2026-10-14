import { Routes } from '@angular/router';

export const MECANICOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Mecánicos',
    loadComponent: () => import('./mecanicos/mecanicos-lista').then((m) => m.MecanicosLista),
  },
  {
    path: 'nuevo',
    title: 'Nuevo mecánico',
    loadComponent: () =>
      import('./mecanicos/mecanico-formulario').then((m) => m.MecanicoFormulario),
  },
  {
    path: ':id/editar',
    title: 'Editar mecánico',
    loadComponent: () =>
      import('./mecanicos/mecanico-formulario').then((m) => m.MecanicoFormulario),
  },
];

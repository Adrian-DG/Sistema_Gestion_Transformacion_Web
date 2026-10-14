import { Routes } from '@angular/router';

export const INVENTARIO_ROUTES: Routes = [
  {
    path: '',
    title: 'Inventario de piezas',
    loadComponent: () => import('./piezas/piezas-lista').then((m) => m.PiezasLista),
  },
  {
    path: 'nueva',
    title: 'Nueva pieza',
    loadComponent: () => import('./piezas/pieza-formulario').then((m) => m.PiezaFormulario),
  },
  {
    path: 'entradas',
    title: 'Entradas al inventario',
    loadComponent: () => import('./entradas/entradas-lista').then((m) => m.EntradasLista),
  },
  {
    path: 'entradas/nueva',
    title: 'Nueva entrada',
    loadComponent: () => import('./entradas/entrada-formulario').then((m) => m.EntradaFormulario),
  },
  {
    path: ':id/editar',
    title: 'Editar pieza',
    loadComponent: () => import('./piezas/pieza-formulario').then((m) => m.PiezaFormulario),
  },
  {
    path: ':id/kardex',
    title: 'Kardex de la pieza',
    loadComponent: () => import('./piezas/pieza-kardex').then((m) => m.PiezaKardex),
  },
];

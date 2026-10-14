import { Routes } from '@angular/router';

export const PROVEEDORES_ROUTES: Routes = [
  {
    path: '',
    title: 'Proveedores',
    loadComponent: () => import('./proveedores/proveedores-lista').then((m) => m.ProveedoresLista),
  },
  {
    path: 'nuevo',
    title: 'Nuevo proveedor',
    loadComponent: () =>
      import('./proveedores/proveedor-formulario').then((m) => m.ProveedorFormulario),
  },
  {
    path: ':id/editar',
    title: 'Editar proveedor',
    loadComponent: () =>
      import('./proveedores/proveedor-formulario').then((m) => m.ProveedorFormulario),
  },
];

import { Routes } from '@angular/router';

export const VEHICULOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Vehículos',
    loadComponent: () => import('./lista/vehiculos-lista').then((m) => m.VehiculosLista),
  },
  {
    path: 'nuevo',
    title: 'Nuevo vehículo',
    loadComponent: () =>
      import('./formulario/vehiculo-formulario').then((m) => m.VehiculoFormulario),
  },
  {
    path: ':id/editar',
    title: 'Editar vehículo',
    loadComponent: () =>
      import('./formulario/vehiculo-formulario').then((m) => m.VehiculoFormulario),
  },
];

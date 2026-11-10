import { Routes } from '@angular/router';
import { permisoGuard } from '../../core/auth/auth.guards';
import { Permiso } from '../../core/auth/permisos';

export const VEHICULOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Vehículos',
    loadComponent: () => import('./lista/vehiculos-lista').then((m) => m.VehiculosLista),
  },
  {
    path: 'nuevo',
    canActivate: [permisoGuard],
    data: { permisos: [Permiso.GestionVehiculos] },
    title: 'Nuevo vehículo',
    loadComponent: () =>
      import('./formulario/vehiculo-formulario').then((m) => m.VehiculoFormulario),
  },
  {
    path: ':id/historial',
    title: 'Historial del vehículo',
    loadComponent: () => import('./historial/vehiculo-historial').then((m) => m.VehiculoHistorial),
  },
  {
    path: ':id/editar',
    canActivate: [permisoGuard],
    data: { permisos: [Permiso.GestionVehiculos] },
    title: 'Editar vehículo',
    loadComponent: () =>
      import('./formulario/vehiculo-formulario').then((m) => m.VehiculoFormulario),
  },
];

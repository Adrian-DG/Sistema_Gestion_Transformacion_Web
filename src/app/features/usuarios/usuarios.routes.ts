import { Routes } from '@angular/router';

export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Usuarios',
    loadComponent: () => import('./lista/usuarios-lista').then((m) => m.UsuariosLista),
  },
  {
    path: 'nuevo',
    title: 'Nuevo usuario',
    loadComponent: () => import('./formulario/usuario-formulario').then((m) => m.UsuarioFormulario),
  },
  {
    path: ':id',
    title: 'Usuario',
    loadComponent: () => import('./detalle/usuario-detalle').then((m) => m.UsuarioDetalleComponent),
  },
  {
    path: ':id/editar',
    title: 'Editar usuario',
    loadComponent: () => import('./formulario/usuario-formulario').then((m) => m.UsuarioFormulario),
  },
];

import { Routes } from '@angular/router';
import { autenticadoGuard, invitadoGuard, permisoGuard } from './core/auth/auth.guards';
import { Permiso } from './core/auth/permisos';
import { MENU } from './layout/navegacion';

/** Módulos ya implementados; el resto muestra la página "en desarrollo". */
const modulos: Routes = [
  {
    path: 'usuarios',
    canActivate: [permisoGuard],
    data: { permisos: [Permiso.GestionUsuarios] },
    loadChildren: () =>
      import('./features/usuarios/usuarios.routes').then((m) => m.USUARIOS_ROUTES),
  },
];

/** Módulos de las fases siguientes: por ahora muestran "en desarrollo", con sus permisos ya aplicados. */
const modulosPendientes: Routes = MENU.flatMap((g) => g.elementos)
  .filter((e) => e.ruta !== '/inicio' && !modulos.some((m) => `/${m.path}` === e.ruta))
  .map((e) => ({
    path: e.ruta.slice(1),
    title: e.titulo,
    canActivate: [permisoGuard],
    data: { permisos: e.permisos, titulo: e.titulo, descripcion: e.descripcion },
    loadComponent: () => import('./features/sistema/paginas-sistema').then((m) => m.Proximamente),
  }));

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio',
        loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
      },
      ...modulos,
      ...modulosPendientes,
      {
        path: 'acceso-denegado',
        title: 'Acceso denegado',
        loadComponent: () =>
          import('./features/sistema/paginas-sistema').then((m) => m.AccesoDenegado),
      },
      {
        path: '**',
        title: 'Página no encontrada',
        loadComponent: () =>
          import('./features/sistema/paginas-sistema').then((m) => m.NoEncontrado),
      },
    ],
  },
];

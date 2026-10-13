import { Routes } from '@angular/router';
import { autenticadoGuard, invitadoGuard, permisoGuard } from './core/auth/auth.guards';
import { MENU } from './layout/navegacion';

/** Módulos de las fases siguientes: por ahora muestran "en desarrollo", con sus permisos ya aplicados. */
const modulosPendientes: Routes = MENU.flatMap((g) => g.elementos)
  .filter((e) => e.ruta !== '/inicio')
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

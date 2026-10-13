# Sistema de Gestión de Transportación — Web

Frontend en Angular 22 + Tailwind CSS 4 para la Dirección de Transportación (J-4).

## Desarrollo

1. Inicie la API con el perfil `https` (escucha en `https://localhost:7223`).
2. Ejecute `npm start` y abra `http://localhost:4200/`.

`ng serve` reenvía `/api` a la API local (ver `proxy.conf.json`), por lo que en desarrollo no hace falta CORS.
Para publicar en otro dominio que la API, ajuste `apiUrl` en `src/environments/environment.ts` y agregue el
origen a `Cors:Origenes` en el backend.

Pruebas unitarias: `npm test`.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `core/` | Servicios únicos: API, autenticación (JWT, guards), interceptores, apariencia, avisos y diálogos |
| `layout/` | Estructura de la aplicación (encabezado, menú lateral) y configuración del menú (`navegacion.ts`) |
| `shared/` | Componentes reutilizables: tabla, paginador, campos de formulario, selector de archivos, estados |
| `features/` | Pantallas por módulo |

## Apariencia

El logo, el nombre del sistema y los colores vienen de `GET api/configuracion/apariencia`.
Al iniciar se aplican los guardados en IndexedDB (base `sgt`) y luego se sincronizan con la API
cuando cambia la versión. Los colores se exponen como utilidades de Tailwind (`bg-primario`,
`text-secundario`, …) y clases de botón (`btn btn-primario`, `btn-secundario`, `btn-peligro`).

## Permisos

El menú y las rutas usan los permisos del token (`Permiso` en `core/auth/permisos.ts`, espejo de
`AppPermission` del backend). Para un módulo nuevo, agréguelo en `layout/navegacion.ts` con sus permisos
y reemplace en `app.routes.ts` la pantalla "en desarrollo" por la real.

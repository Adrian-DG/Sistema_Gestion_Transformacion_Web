import { Permiso } from '../core/auth/permisos';
import { NombreIcono } from '../shared/ui/icono/icono';

export interface ElementoMenu {
  titulo: string;
  ruta: string;
  icono: NombreIcono;
  /** Basta con uno; vacío = cualquier usuario autenticado. Administrador ve todo. */
  permisos: Permiso[];
  descripcion: string;
}

export interface GrupoMenu {
  titulo: string;
  elementos: ElementoMenu[];
}

/**
 * Menú lateral. Las rutas y permisos coinciden con app.routes.ts y con las políticas de la API,
 * así cada usuario solo ve lo que puede usar.
 */
export const MENU: GrupoMenu[] = [
  {
    titulo: 'General',
    elementos: [
      {
        titulo: 'Inicio',
        ruta: '/inicio',
        icono: 'inicio',
        permisos: [],
        descripcion: 'Resumen de la operación',
      },
    ],
  },
  {
    titulo: 'Operaciones',
    elementos: [
      {
        titulo: 'Asignaciones',
        ruta: '/asignaciones',
        icono: 'asignacion',
        permisos: [Permiso.GestionAsignaciones],
        descripcion: 'Solicitudes, aprobación y retorno de vehículos',
      },
      {
        titulo: 'Combustible',
        ruta: '/combustible',
        icono: 'combustible',
        permisos: [Permiso.GestionCombustible],
        descripcion: 'Existencia, compras, despachos y tickets',
      },
    ],
  },
  {
    titulo: 'Inventario',
    elementos: [
      {
        titulo: 'Vehículos',
        ruta: '/vehiculos',
        icono: 'vehiculo',
        permisos: [Permiso.GestionVehiculos],
        descripcion: 'Flota, matrículas y datos generales',
      },
      {
        titulo: 'Pólizas',
        ruta: '/polizas',
        icono: 'poliza',
        permisos: [Permiso.GestionPolizas],
        descripcion: 'Seguros de los vehículos',
      },
    ],
  },
  {
    titulo: 'Taller',
    elementos: [
      {
        titulo: 'Solicitudes de taller',
        ruta: '/taller',
        icono: 'herramienta',
        permisos: [Permiso.GestionTaller],
        descripcion: 'Ingreso, piezas utilizadas y cierre de mantenimientos',
      },
      {
        titulo: 'Mecánicos',
        ruta: '/mecanicos',
        icono: 'mecanico',
        permisos: [Permiso.GestionTaller],
        descripcion: 'Personal militar y civil del taller',
      },
      {
        titulo: 'Inventario de piezas',
        ruta: '/inventario-piezas',
        icono: 'pieza',
        permisos: [Permiso.GestionInventarioPiezas],
        descripcion: 'Existencias, entradas y kardex',
      },
      {
        titulo: 'Proveedores',
        ruta: '/proveedores',
        icono: 'proveedor',
        permisos: [Permiso.GestionInventarioPiezas],
        descripcion: 'Suplidores de piezas',
      },
    ],
  },
  {
    titulo: 'Análisis',
    elementos: [
      {
        titulo: 'Reportes',
        ruta: '/reportes',
        icono: 'reporte',
        permisos: [Permiso.GestionCombustible, Permiso.GestionAsignaciones],
        descripcion: 'Estadísticas y reportes Excel por período',
      },
    ],
  },
  {
    titulo: 'Administración',
    elementos: [
      {
        titulo: 'Usuarios',
        ruta: '/usuarios',
        icono: 'usuario',
        permisos: [Permiso.GestionUsuarios],
        descripcion: 'Cuentas, permisos y estado',
      },
      {
        titulo: 'Apariencia',
        ruta: '/apariencia',
        icono: 'apariencia',
        permisos: [Permiso.Administrador],
        descripcion: 'Logo, nombre y colores del sistema',
      },
    ],
  },
];

import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginado, SIN_AVISO_ERROR, api } from '../../core/api/api';
import { ElementoCatalogo } from '../../core/catalogos/catalogos.service';

/** Espejo de TipoPieza del backend. */
export const TIPOS_PIEZA = [
  { valor: 1, nombre: 'Repuesto' },
  { valor: 2, nombre: 'Lubricante o fluido' },
  { valor: 3, nombre: 'Filtro' },
  { valor: 4, nombre: 'Neumático' },
  { valor: 5, nombre: 'Batería' },
  { valor: 6, nombre: 'Eléctrico' },
  { valor: 7, nombre: 'Frenos' },
  { valor: 8, nombre: 'Accesorio' },
  { valor: 0, nombre: 'Otro' },
] as const;
export type TipoPieza = (typeof TIPOS_PIEZA)[number]['valor'];
export const nombreTipoPieza = (tipo: number): string =>
  TIPOS_PIEZA.find((t) => t.valor === tipo)?.nombre ?? 'Otro';

export interface Pieza {
  id: string;
  codigo: string;
  tipo: TipoPieza;
  /** Opcional; identifica la pieza al escanearla. */
  codigoBarras: string | null;
  nombre: string;
  descripcion: string | null;
  unidadMedida: string;
  existenciaMinima: number;
  existencia: number;
  bajoMinimo: boolean;
  activo: boolean;
}

export interface PiezaCatalogo {
  id: string;
  codigo: string;
  tipo: TipoPieza;
  codigoBarras: string | null;
  nombre: string;
  unidadMedida: string;
  existencia: number;
}

export interface DatosPieza {
  codigo: string;
  tipo: TipoPieza;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string | null;
  unidadMedida: string;
  existenciaMinima: number;
}

export type ConceptoMovimientoPieza = 'Entrada' | 'CompraDirecta' | 'Consumo' | 'Devolucion';

export const NOMBRE_CONCEPTO: Record<ConceptoMovimientoPieza, string> = {
  Entrada: 'Entrada al inventario',
  CompraDirecta: 'Compra directa',
  Consumo: 'Consumo en taller',
  Devolucion: 'Devolución',
};

export interface MovimientoPieza {
  id: string;
  fecha: string;
  concepto: ConceptoMovimientoPieza;
  /** Positiva en entradas, negativa en consumos. */
  cantidad: number;
  costoUnitario: number;
  proveedor: string | null;
  numeroFactura: string | null;
  solicitudTaller: string | null;
  placa: string | null;
}

/** Espejo de TipoProveedor del backend. */
export const TIPO_PROVEEDOR = { Otro: 0, Taller: 1, SuplidorCombustible: 2 } as const;
export type TipoProveedor = (typeof TIPO_PROVEEDOR)[keyof typeof TIPO_PROVEEDOR];

export const TIPOS_PROVEEDOR: { valor: TipoProveedor; nombre: string; descripcion: string }[] = [
  {
    valor: TIPO_PROVEEDOR.Taller,
    nombre: 'Taller autorizado',
    descripcion:
      'Concesionario o taller donde se pueden hacer mantenimientos externos, por ejemplo para conservar la garantía de un vehículo nuevo.',
  },
  {
    valor: TIPO_PROVEEDOR.SuplidorCombustible,
    nombre: 'Suplidor de combustible',
    descripcion:
      'Suple gasolina o gasoil. Solo estos proveedores se pueden elegir al registrar una entrada de combustible.',
  },
  {
    valor: TIPO_PROVEEDOR.Otro,
    nombre: 'Otro',
    descripcion: 'Suplidor de piezas u otros servicios.',
  },
];

export const nombreTipoProveedor = (tipo: TipoProveedor): string =>
  TIPOS_PROVEEDOR.find((t) => t.valor === tipo)?.nombre ?? 'Otro';

export interface Proveedor {
  id: string;
  nombre: string;
  rnc: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  contacto: string | null;
  tipo: TipoProveedor;
  activo: boolean;
}

export type DatosProveedor = Omit<Proveedor, 'id' | 'activo'>;

export interface AdjuntoResumen {
  id: string;
  nombreArchivo: string;
  contentType: string;
}

export interface EntradaPieza {
  id: string;
  fecha: string;
  proveedor: string;
  numeroFactura: string | null;
  observacion: string | null;
  cantidadLineas: number;
  total: number;
  adjuntos: AdjuntoResumen[];
  lineas: { codigo: string; pieza: string; cantidad: number; costoUnitario: number }[];
}

export interface AdjuntoNuevo {
  tipoDocumentoId: string;
  nombreArchivo: string;
  contentType: string;
  fileBase64: string;
}

export interface NuevaEntrada {
  proveedorId: string;
  numeroFactura: string | null;
  fecha: string | null;
  observacion: string | null;
  lineas: { piezaId: string; cantidad: number; costoUnitario: number }[];
  adjuntos: AdjuntoNuevo[];
}

export interface FiltroPaginado {
  pagina: number;
  tamano: number;
  busqueda?: string;
}

/** Los formularios muestran los errores en sus campos, sin aviso global. */
const SIN_AVISO = { context: new HttpContext().set(SIN_AVISO_ERROR, true) };

function paginacion(filtro: FiltroPaginado): HttpParams {
  let params = new HttpParams().set('pageNumber', filtro.pagina).set('pageSize', filtro.tamano);
  if (filtro.busqueda) params = params.set('param', filtro.busqueda);
  return params;
}

/** Inventario del taller: piezas (existencia y kardex), proveedores y entradas. */
@Injectable({ providedIn: 'root' })
export class InventarioService {
  private readonly http = inject(HttpClient);

  piezas(
    filtro: FiltroPaginado & { soloBajoMinimo: boolean; activo: boolean | null },
  ): Observable<Paginado<Pieza>> {
    let params = paginacion(filtro);
    if (filtro.soloBajoMinimo) params = params.set('soloBajoMinimo', true);
    if (filtro.activo !== null) params = params.set('activo', filtro.activo);
    return this.http.get<Paginado<Pieza>>(api('inventario-piezas/piezas'), { params });
  }

  /** Piezas activas con su existencia. */
  catalogoPiezas(): Observable<PiezaCatalogo[]> {
    return this.http.get<PiezaCatalogo[]>(api('inventario-piezas/piezas/catalogo'));
  }

  obtenerPieza(id: string): Observable<Pieza> {
    return this.http.get<Pieza>(api(`inventario-piezas/piezas/${id}`));
  }

  crearPieza(datos: DatosPieza): Observable<string> {
    return this.http.post<string>(api('inventario-piezas/piezas'), datos, SIN_AVISO);
  }

  actualizarPieza(id: string, datos: DatosPieza & { activo: boolean }): Observable<void> {
    return this.http.put<void>(api(`inventario-piezas/piezas/${id}`), datos, SIN_AVISO);
  }

  movimientos(piezaId: string, filtro: FiltroPaginado): Observable<Paginado<MovimientoPieza>> {
    return this.http.get<Paginado<MovimientoPieza>>(
      api(`inventario-piezas/piezas/${piezaId}/movimientos`),
      {
        params: paginacion(filtro),
      },
    );
  }

  proveedores(
    filtro: FiltroPaginado & { activo: boolean | null },
  ): Observable<Paginado<Proveedor>> {
    let params = paginacion(filtro);
    if (filtro.activo !== null) params = params.set('activo', filtro.activo);
    return this.http.get<Paginado<Proveedor>>(api('inventario-piezas/proveedores'), { params });
  }

  /** Proveedores activos; con `tipo`, solo los de ese tipo (ej. talleres autorizados). */
  catalogoProveedores(tipo?: TipoProveedor): Observable<ElementoCatalogo[]> {
    return this.http.get<ElementoCatalogo[]>(api('inventario-piezas/proveedores/catalogo'), {
      params: tipo !== undefined ? new HttpParams().set('tipo', tipo) : undefined,
    });
  }

  obtenerProveedor(id: string): Observable<Proveedor> {
    return this.http.get<Proveedor>(api(`inventario-piezas/proveedores/${id}`));
  }

  crearProveedor(datos: DatosProveedor): Observable<string> {
    return this.http.post<string>(api('inventario-piezas/proveedores'), datos, SIN_AVISO);
  }

  actualizarProveedor(id: string, datos: DatosProveedor & { activo: boolean }): Observable<void> {
    return this.http.put<void>(api(`inventario-piezas/proveedores/${id}`), datos, SIN_AVISO);
  }

  entradas(filtro: FiltroPaginado): Observable<Paginado<EntradaPieza>> {
    return this.http.get<Paginado<EntradaPieza>>(api('inventario-piezas/entradas'), {
      params: paginacion(filtro),
    });
  }

  registrarEntrada(entrada: NuevaEntrada): Observable<string> {
    return this.http.post<string>(api('inventario-piezas/entradas'), entrada, SIN_AVISO);
  }

  /** Factura o recibo adjunto (requiere el token, por eso no es un enlace directo). */
  adjunto(id: string): Observable<Blob> {
    return this.http.get(api(`taller/adjuntos/${id}`), { responseType: 'blob' });
  }
}

/** Abre el archivo en una pestaña nueva (o lo descarga si el navegador no puede mostrarlo). */
export function abrirArchivo(archivo: Blob): void {
  const url = URL.createObjectURL(archivo);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Formato de moneda (RD$) para costos. */
export function moneda(valor: number): string {
  return valor.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' });
}

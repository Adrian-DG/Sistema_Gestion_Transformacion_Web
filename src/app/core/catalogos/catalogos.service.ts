import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { api } from '../api/api';

/**
 * Flujos que reciben documentos (espejo de TiposOperacion del backend). Cada uno solo admite ciertos
 * tipos de documento.
 */
export const TIPOS_OPERACION = {
  Vehiculo: '6f1f1d2a-3c1e-4b7a-9a51-0b7c2d9e1a01',
  Asignacion: '6f1f1d2a-3c1e-4b7a-9a51-0b7c2d9e1a02',
  SolicitudTicket: '6f1f1d2a-3c1e-4b7a-9a51-0b7c2d9e1a03',
  MovimientoCombustible: '6f1f1d2a-3c1e-4b7a-9a51-0b7c2d9e1a04',
  EntradaPieza: '6f1f1d2a-3c1e-4b7a-9a51-0b7c2d9e1a05',
  CompraPieza: '6f1f1d2a-3c1e-4b7a-9a51-0b7c2d9e1a06',
  SolicitudTaller: '6f1f1d2a-3c1e-4b7a-9a51-0b7c2d9e1a07',
} as const;
export type TipoOperacion = (typeof TIPOS_OPERACION)[keyof typeof TIPOS_OPERACION];

export interface ElementoCatalogo {
  id: string;
  nombre: string;
}

export interface Rango extends ElementoCatalogo {
  /** Denominación equivalente en la Armada. */
  nombreArmada: string;
}

export interface Modelo extends ElementoCatalogo {
  marcaId: string;
}

/**
 * Catálogos de la API (api/catalogos). Los fijos se consultan una vez por sesión de navegador; los
 * vehículos cambian con frecuencia y se consultan cada vez.
 */
@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<unknown>>();

  rangos(): Observable<Rango[]> {
    return this.cacheado<Rango[]>('rangos');
  }

  marcas(): Observable<ElementoCatalogo[]> {
    return this.cacheado<ElementoCatalogo[]>('marcas');
  }

  modelos(): Observable<Modelo[]> {
    return this.cacheado<Modelo[]>('modelos');
  }

  colores(): Observable<ElementoCatalogo[]> {
    return this.cacheado<ElementoCatalogo[]>('colores');
  }

  tiposVehiculo(): Observable<ElementoCatalogo[]> {
    return this.cacheado<ElementoCatalogo[]>('tipos-vehiculo');
  }

  aseguradoras(): Observable<ElementoCatalogo[]> {
    return this.cacheado<ElementoCatalogo[]>('aseguradoras');
  }

  /** Tipos de documento permitidos en el flujo indicado. */
  tiposDocumento(operacion: TipoOperacion): Observable<ElementoCatalogo[]> {
    return this.cacheado<ElementoCatalogo[]>(`tipos-documento?operacion=${operacion}`);
  }

  /** Vehículos para listas de selección; nombre: "Placa · Marca Modelo (año)". */
  vehiculos(): Observable<ElementoCatalogo[]> {
    return this.http.get<ElementoCatalogo[]>(api('catalogos/vehiculos'));
  }

  private cacheado<T>(ruta: string): Observable<T> {
    let catalogo = this.cache.get(ruta) as Observable<T> | undefined;
    if (!catalogo) {
      catalogo = this.http.get<T>(api(`catalogos/${ruta}`)).pipe(
        // Si falla, no se guarda el error: el próximo uso vuelve a consultar.
        catchError((error) => {
          this.cache.delete(ruta);
          return throwError(() => error);
        }),
        shareReplay(1),
      );
      this.cache.set(ruta, catalogo);
    }
    return catalogo;
  }
}

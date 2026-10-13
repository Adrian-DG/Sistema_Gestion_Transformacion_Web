import { Injectable } from '@angular/core';

const BASE_DATOS = 'sgt';
const VERSION = 1;
const COLECCION = 'clave-valor';

/**
 * Almacén clave-valor sobre IndexedDB (admite Blob, a diferencia de localStorage).
 * Nunca lanza errores: en modo privado o con el almacenamiento bloqueado se comporta como vacío.
 */
@Injectable({ providedIn: 'root' })
export class AlmacenLocal {
  private conexion?: Promise<IDBDatabase | null>;

  async obtener<T>(clave: string): Promise<T | null> {
    const db = await this.abrir();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const solicitud = db.transaction(COLECCION, 'readonly').objectStore(COLECCION).get(clave);
        solicitud.onsuccess = () => resolve((solicitud.result as T | undefined) ?? null);
        solicitud.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async guardar<T>(clave: string, valor: T): Promise<void> {
    await this.escribir((store) => store.put(valor, clave));
  }

  async eliminar(clave: string): Promise<void> {
    await this.escribir((store) => store.delete(clave));
  }

  private async escribir(operacion: (store: IDBObjectStore) => IDBRequest): Promise<void> {
    const db = await this.abrir();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const transaccion = db.transaction(COLECCION, 'readwrite');
        operacion(transaccion.objectStore(COLECCION));
        transaccion.oncomplete = () => resolve();
        transaccion.onerror = () => resolve();
        transaccion.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private abrir(): Promise<IDBDatabase | null> {
    this.conexion ??= new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') {
          resolve(null);
          return;
        }

        const solicitud = indexedDB.open(BASE_DATOS, VERSION);
        solicitud.onupgradeneeded = () => solicitud.result.createObjectStore(COLECCION);
        solicitud.onsuccess = () => resolve(solicitud.result);
        solicitud.onerror = () => resolve(null);
        solicitud.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.conexion;
  }
}

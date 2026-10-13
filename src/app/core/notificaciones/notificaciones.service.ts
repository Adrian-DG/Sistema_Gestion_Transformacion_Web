import { Injectable, signal } from '@angular/core';

export type TipoNotificacion = 'exito' | 'error' | 'advertencia' | 'info';

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  mensaje: string;
}

const DURACION_MS: Record<TipoNotificacion, number> = {
  exito: 4000,
  info: 5000,
  advertencia: 7000,
  error: 8000,
};

/** Avisos breves en la esquina de la pantalla (ver ToastsComponent). */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private siguienteId = 1;
  private readonly _activas = signal<Notificacion[]>([]);
  readonly activas = this._activas.asReadonly();

  exito(mensaje: string): void {
    this.mostrar('exito', mensaje);
  }

  error(mensaje: string): void {
    this.mostrar('error', mensaje);
  }

  advertencia(mensaje: string): void {
    this.mostrar('advertencia', mensaje);
  }

  info(mensaje: string): void {
    this.mostrar('info', mensaje);
  }

  cerrar(id: number): void {
    this._activas.update((lista) => lista.filter((n) => n.id !== id));
  }

  private mostrar(tipo: TipoNotificacion, mensaje: string): void {
    // Evita apilar el mismo aviso varias veces (ej. varias peticiones fallidas a la vez).
    if (this._activas().some((n) => n.tipo === tipo && n.mensaje === mensaje)) return;

    const id = this.siguienteId++;
    this._activas.update((lista) => [...lista.slice(-4), { id, tipo, mensaje }]);
    setTimeout(() => this.cerrar(id), DURACION_MS[tipo]);
  }
}

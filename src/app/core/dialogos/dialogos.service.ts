import { Injectable, signal } from '@angular/core';

export interface OpcionesDialogo {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** "peligro" para acciones destructivas o irreversibles (rechazar, cancelar, desactivar). */
  tipo?: 'primario' | 'peligro';
  /** Pide un texto obligatorio, ej. el motivo de un rechazo. */
  motivo?: { etiqueta: string; maximo?: number };
}

export interface DialogoActivo extends OpcionesDialogo {
  resolver: (resultado: string | boolean | null) => void;
}

/** Diálogos modales de confirmación (ver ConfirmacionComponent, montado en la raíz). */
@Injectable({ providedIn: 'root' })
export class DialogosService {
  private readonly _activo = signal<DialogoActivo | null>(null);
  readonly activo = this._activo.asReadonly();

  /** Devuelve true si el usuario confirma. */
  async confirmar(opciones: Omit<OpcionesDialogo, 'motivo'>): Promise<boolean> {
    return (await this.abrir(opciones)) === true;
  }

  /** Devuelve el motivo escrito, o null si el usuario cancela. */
  async solicitarMotivo(
    opciones: OpcionesDialogo & { motivo: NonNullable<OpcionesDialogo['motivo']> },
  ): Promise<string | null> {
    const resultado = await this.abrir(opciones);
    return typeof resultado === 'string' ? resultado : null;
  }

  private abrir(opciones: OpcionesDialogo): Promise<string | boolean | null> {
    this._activo()?.resolver(null);

    return new Promise((resolve) => {
      this._activo.set({
        ...opciones,
        resolver: (resultado) => {
          this._activo.set(null);
          resolve(resultado);
        },
      });
    });
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  NotificacionesService,
  TipoNotificacion,
} from '../../../core/notificaciones/notificaciones.service';
import { Icono } from '../icono/icono';

const ESTILOS: Record<TipoNotificacion, string> = {
  exito: 'border-emerald-600 text-emerald-700',
  error: 'border-red-600 text-red-700',
  advertencia: 'border-amber-500 text-amber-700',
  info: 'border-sky-600 text-sky-700',
};

@Component({
  selector: 'app-toasts',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      aria-live="polite"
      role="status"
    >
      @for (n of notificaciones.activas(); track n.id) {
        <div
          class="pointer-events-auto flex w-full items-start gap-3 rounded-md border-l-4 bg-white p-3 shadow-lg ring-1 ring-slate-200"
          [class]="estilos[n.tipo]"
          [attr.role]="n.tipo === 'error' ? 'alert' : null"
        >
          <app-icono [nombre]="n.tipo" class="mt-0.5" />
          <p class="flex-1 text-sm text-slate-800">{{ n.mensaje }}</p>
          <button
            type="button"
            class="rounded p-0.5 text-slate-400 hover:text-slate-700"
            (click)="notificaciones.cerrar(n.id)"
            aria-label="Cerrar aviso"
          >
            <app-icono nombre="cerrar" [tamano]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class Toasts {
  protected readonly notificaciones = inject(NotificacionesService);
  protected readonly estilos = ESTILOS;
}

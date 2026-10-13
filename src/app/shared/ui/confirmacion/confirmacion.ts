import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DialogosService } from '../../../core/dialogos/dialogos.service';
import { Icono } from '../icono/icono';

/** Usa el elemento nativo <dialog>: foco atrapado, Escape y fondo modal sin dependencias. */
@Component({
  selector: 'app-confirmacion',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialogo
      class="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-0 shadow-xl backdrop:bg-slate-900/50"
      aria-labelledby="confirmacion-titulo"
      (cancel)="$event.preventDefault(); responder(null)"
    >
      @if (dialogos.activo(); as d) {
        <form method="dialog" class="p-6" (submit)="$event.preventDefault(); aceptar()">
          <div class="flex items-start gap-4">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full"
              [class]="
                d.tipo === 'peligro' ? 'bg-red-100 text-red-700' : 'bg-primario/10 text-primario'
              "
            >
              <app-icono [nombre]="d.tipo === 'peligro' ? 'advertencia' : 'info'" />
            </span>
            <div class="flex-1">
              <h2 id="confirmacion-titulo" class="text-base font-semibold text-slate-900">
                {{ d.titulo }}
              </h2>
              <p class="mt-1 text-sm text-slate-600">{{ d.mensaje }}</p>

              @if (d.motivo; as m) {
                <label
                  class="mt-4 block text-sm font-medium text-slate-700"
                  for="confirmacion-motivo"
                >
                  {{ m.etiqueta }} <span class="text-red-600">*</span>
                </label>
                <textarea
                  id="confirmacion-motivo"
                  class="control mt-1"
                  rows="3"
                  [attr.maxlength]="m.maximo ?? 500"
                  [value]="motivo()"
                  (input)="motivo.set($any($event.target).value)"
                ></textarea>
                @if (intentado() && !motivo().trim()) {
                  <p class="mt-1 text-xs text-red-600">Este campo es obligatorio.</p>
                }
              }
            </div>
          </div>

          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="btn btn-contorno" (click)="responder(null)">
              {{ d.textoCancelar ?? 'Cancelar' }}
            </button>
            <button
              type="submit"
              class="btn"
              [class]="d.tipo === 'peligro' ? 'btn-peligro' : 'btn-primario'"
            >
              {{ d.textoConfirmar ?? 'Confirmar' }}
            </button>
          </div>
        </form>
      }
    </dialog>
  `,
})
export class Confirmacion {
  protected readonly dialogos = inject(DialogosService);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  protected readonly motivo = signal('');
  protected readonly intentado = signal(false);

  constructor() {
    effect(() => {
      const elemento = this.dialogo().nativeElement;
      if (this.dialogos.activo()) {
        this.motivo.set('');
        this.intentado.set(false);
        if (!elemento.open) elemento.showModal();
      } else if (elemento.open) {
        elemento.close();
      }
    });
  }

  protected aceptar(): void {
    const activo = this.dialogos.activo();
    if (!activo) return;

    if (activo.motivo) {
      this.intentado.set(true);
      const texto = this.motivo().trim();
      if (!texto) return;
      activo.resolver(texto);
    } else {
      activo.resolver(true);
    }
  }

  protected responder(resultado: null): void {
    this.dialogos.activo()?.resolver(resultado);
  }
}

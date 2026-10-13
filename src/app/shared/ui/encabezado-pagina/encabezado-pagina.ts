import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Título de página con descripción opcional; las acciones se proyectan a la derecha. */
@Component({
  selector: 'app-encabezado-pagina',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between' },
  template: `
    <div>
      @if (seccion()) {
        <p class="text-xs font-semibold tracking-wider text-secundario uppercase">
          {{ seccion() }}
        </p>
      }
      <h1 class="text-2xl font-bold text-primario">{{ titulo() }}</h1>
      @if (descripcion()) {
        <p class="mt-1 text-sm text-slate-600">{{ descripcion() }}</p>
      }
    </div>
    <div class="flex flex-wrap gap-2">
      <ng-content />
    </div>
  `,
})
export class EncabezadoPagina {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  readonly seccion = input<string>();
}

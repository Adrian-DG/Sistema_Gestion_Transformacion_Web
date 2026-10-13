import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-cargando',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2 text-sm text-slate-500', role: 'status' },
  template: `
    <span
      class="animate-spin rounded-full border-2 border-current border-t-transparent"
      [style.width.px]="tamano()"
      [style.height.px]="tamano()"
    ></span>
    @if (texto()) {
      <span>{{ texto() }}</span>
    } @else {
      <span class="sr-only">Cargando</span>
    }
  `,
})
export class Cargando {
  readonly texto = input<string>();
  readonly tamano = input(16);
}

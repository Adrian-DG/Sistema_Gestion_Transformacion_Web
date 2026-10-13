import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AparienciaService } from '../../core/apariencia/apariencia.service';

/** Logo institucional; si no hay logo configurado, muestra las siglas en un escudo. */
@Component({
  selector: 'app-marca',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (apariencia.logoUrl(); as logo) {
      <img
        [src]="logo"
        alt="Logo institucional"
        class="object-contain"
        [style.height.px]="tamano()"
        [style.max-width.px]="tamano() * 2.5"
      />
    } @else {
      <span
        class="flex items-center justify-center rounded-md border-2 border-secundario bg-primario font-bold text-primario-contraste"
        [style.width.px]="tamano()"
        [style.height.px]="tamano()"
        [style.font-size.px]="tamano() * 0.32"
        aria-hidden="true"
      >
        {{ (apariencia.apariencia().nombreCorto || 'SGT').slice(0, 4) }}
      </span>
    }
  `,
})
export class Marca {
  protected readonly apariencia = inject(AparienciaService);
  readonly tamano = input(40);
}

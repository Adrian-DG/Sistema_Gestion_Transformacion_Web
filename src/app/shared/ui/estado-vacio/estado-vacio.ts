import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icono, NombreIcono } from '../icono/icono';

@Component({
  selector: 'app-estado-vacio',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-center justify-center px-6 py-12 text-center' },
  template: `
    <span class="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      <app-icono [nombre]="icono()" [tamano]="24" />
    </span>
    <p class="mt-3 text-sm font-semibold text-slate-800">{{ titulo() }}</p>
    @if (mensaje()) {
      <p class="mt-1 max-w-sm text-sm text-slate-500">{{ mensaje() }}</p>
    }
    <div class="mt-4"><ng-content /></div>
  `,
})
export class EstadoVacio {
  readonly titulo = input('No hay registros');
  readonly mensaje = input<string>();
  readonly icono = input<NombreIcono>('vacio');
}

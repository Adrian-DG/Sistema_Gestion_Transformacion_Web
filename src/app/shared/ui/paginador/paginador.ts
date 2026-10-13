import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icono } from '../icono/icono';

export interface CambioPagina {
  pagina: number;
  tamano: number;
}

@Component({
  selector: 'app-paginador',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between',
  },
  template: `
    <p>
      @if (total() > 0) {
        Mostrando <strong>{{ desde() }}</strong
        >–<strong>{{ hasta() }}</strong> de
        <strong>{{ total() }}</strong>
      } @else {
        Sin resultados
      }
    </p>

    <div class="flex items-center gap-3">
      <label class="flex items-center gap-2">
        <span class="hidden sm:inline">Por página</span>
        <select
          class="control w-auto py-1"
          (change)="cambiar(1, +$any($event.target).value)"
          aria-label="Registros por página"
        >
          @for (opcion of opciones(); track opcion) {
            <option [value]="opcion" [selected]="opcion === tamano()">{{ opcion }}</option>
          }
        </select>
      </label>

      <nav class="flex items-center gap-1" aria-label="Paginación">
        <button
          type="button"
          class="btn btn-contorno btn-sm"
          [disabled]="pagina() <= 1"
          (click)="cambiar(pagina() - 1, tamano())"
          aria-label="Página anterior"
        >
          <app-icono nombre="izquierda" [tamano]="16" />
        </button>
        <span class="px-2 whitespace-nowrap">{{ pagina() }} / {{ paginas() }}</span>
        <button
          type="button"
          class="btn btn-contorno btn-sm"
          [disabled]="pagina() >= paginas()"
          (click)="cambiar(pagina() + 1, tamano())"
          aria-label="Página siguiente"
        >
          <app-icono nombre="derecha" [tamano]="16" />
        </button>
      </nav>
    </div>
  `,
})
export class Paginador {
  readonly pagina = input.required<number>();
  readonly tamano = input.required<number>();
  readonly total = input.required<number>();
  readonly opciones = input([10, 20, 50, 100]);
  readonly cambio = output<CambioPagina>();

  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamano())));
  protected readonly desde = computed(() => (this.pagina() - 1) * this.tamano() + 1);
  protected readonly hasta = computed(() => Math.min(this.pagina() * this.tamano(), this.total()));

  protected cambiar(pagina: number, tamano: number): void {
    this.cambio.emit({ pagina, tamano });
  }
}

import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
} from '@angular/core';
import { Cargando } from '../cargando/cargando';
import { EstadoVacio } from '../estado-vacio/estado-vacio';

export interface Columna {
  clave: string;
  titulo: string;
  alineacion?: 'izquierda' | 'centro' | 'derecha';
  /** Oculta la columna en pantallas pequeñas. */
  ocultarEnMovil?: boolean;
}

/**
 * Plantilla personalizada para una columna:
 * `<ng-template appCelda="estado" let-fila>…</ng-template>`
 */
@Directive({ selector: 'ng-template[appCelda]' })
export class Celda {
  readonly appCelda = input.required<string>();
  readonly plantilla = inject<TemplateRef<{ $implicit: unknown }>>(TemplateRef);
}

const ALINEACION = { izquierda: 'text-left', centro: 'text-center', derecha: 'text-right' };

@Component({
  selector: 'app-tabla',
  imports: [NgTemplateOutlet, Cargando, EstadoVacio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-sm" [attr.aria-busy]="cargando()">
        <thead class="bg-slate-50">
          <tr>
            @for (c of columnas(); track c.clave) {
              <th
                scope="col"
                class="px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-600 uppercase"
                [class]="clasesColumna(c)"
              >
                {{ c.titulo }}
              </th>
            }
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          @if (!cargando()) {
            @for (fila of filas(); track $index) {
              <tr class="hover:bg-slate-50">
                @for (c of columnas(); track c.clave) {
                  <td class="px-4 py-3 text-slate-700" [class]="clasesColumna(c)">
                    @if (plantillas().get(c.clave); as plantilla) {
                      <ng-container *ngTemplateOutlet="plantilla; context: { $implicit: fila }" />
                    } @else {
                      {{ valor(fila, c.clave) }}
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    @if (cargando()) {
      <div class="flex justify-center py-10"><app-cargando texto="Cargando…" /></div>
    } @else if (filas().length === 0) {
      <app-estado-vacio [titulo]="mensajeVacio()" />
    }
  `,
})
export class Tabla<T extends object> {
  readonly columnas = input.required<Columna[]>();
  readonly filas = input.required<T[]>();
  readonly cargando = input(false);
  readonly mensajeVacio = input('No hay registros para mostrar');

  private readonly celdas = contentChildren(Celda);
  protected readonly plantillas = computed(
    () => new Map(this.celdas().map((c) => [c.appCelda(), c.plantilla])),
  );

  protected clasesColumna(c: Columna): string {
    return `${ALINEACION[c.alineacion ?? 'izquierda']} ${c.ocultarEnMovil ? 'hidden md:table-cell' : ''}`;
  }

  protected valor(fila: T, clave: string): unknown {
    const valor = (fila as Record<string, unknown>)[clave];
    return valor === null || valor === undefined || valor === '' ? '—' : valor;
  }
}

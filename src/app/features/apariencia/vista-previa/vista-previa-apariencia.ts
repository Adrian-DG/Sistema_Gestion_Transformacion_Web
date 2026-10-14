import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { normalizarHex, textoSobre } from '../../../core/apariencia/colores';

export interface ColoresApariencia {
  nombreSistema: string;
  nombreInstitucion: string | null;
  colorPrimario: string;
  colorSecundario: string;
  colorBotonPrimario: string;
  colorBotonSecundario: string;
  colorBotonPeligro: string;
}

/**
 * Maqueta reducida del sistema (barra superior y botones) con los colores indicados, para ver cómo
 * se verá una apariencia antes de activarla. No usa las variables CSS globales.
 */
@Component({
  selector: 'app-vista-previa-apariencia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-hidden rounded-md border border-slate-200 bg-slate-50' },
  template: `
    <div
      class="flex items-center gap-3 px-4 py-3"
      [style.background-color]="c().primario"
      [style.color]="c().primarioTexto"
    >
      @if (logoUrl(); as logo) {
        <img [src]="logo" alt="" class="size-9 rounded bg-white/90 object-contain p-0.5" />
      } @else {
        <span
          class="flex size-9 items-center justify-center rounded text-sm font-bold"
          [style.background-color]="c().secundario"
          [style.color]="c().secundarioTexto"
          aria-hidden="true"
          >{{ iniciales() }}</span
        >
      }
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold">{{ apariencia().nombreSistema || 'Nombre del sistema' }}</p>
        @if (apariencia().nombreInstitucion) {
          <p class="truncate text-xs opacity-80">{{ apariencia().nombreInstitucion }}</p>
        }
      </div>
    </div>
    <div class="h-1" [style.background-color]="c().secundario"></div>
    @if (!compacta()) {
      <div class="flex flex-wrap gap-2 p-4">
        <span
          class="rounded-md px-3 py-1.5 text-xs font-semibold"
          [style.background-color]="c().btnPrimario"
          [style.color]="c().btnPrimarioTexto"
          >Guardar</span
        >
        <span
          class="rounded-md px-3 py-1.5 text-xs font-semibold"
          [style.background-color]="c().btnSecundario"
          [style.color]="c().btnSecundarioTexto"
          >Secundario</span
        >
        <span
          class="rounded-md px-3 py-1.5 text-xs font-semibold"
          [style.background-color]="c().btnPeligro"
          [style.color]="c().btnPeligroTexto"
          >Desactivar</span
        >
      </div>
    }
  `,
})
export class VistaPreviaApariencia {
  readonly apariencia = input.required<ColoresApariencia>();
  readonly logoUrl = input<string | null>(null);
  /** Solo la barra superior (para tarjetas del listado). */
  readonly compacta = input(false);

  /** Colores normalizados; un valor inválido mientras se escribe se muestra en gris. */
  protected readonly c = computed(() => {
    const a = this.apariencia();
    const color = (valor: string) => normalizarHex(valor) ?? '#94A3B8';
    const primario = color(a.colorPrimario);
    const secundario = color(a.colorSecundario);
    const btnPrimario = color(a.colorBotonPrimario);
    const btnSecundario = color(a.colorBotonSecundario);
    const btnPeligro = color(a.colorBotonPeligro);
    return {
      primario,
      primarioTexto: textoSobre(primario),
      secundario,
      secundarioTexto: textoSobre(secundario),
      btnPrimario,
      btnPrimarioTexto: textoSobre(btnPrimario),
      btnSecundario,
      btnSecundarioTexto: textoSobre(btnSecundario),
      btnPeligro,
      btnPeligroTexto: textoSobre(btnPeligro),
    };
  });

  protected readonly iniciales = computed(() =>
    (this.apariencia().nombreSistema || 'S')
      .split(/\s+/)
      .filter((p) => p.length > 2)
      .slice(0, 3)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icono } from '../../../shared/ui/icono/icono';
import { PiezaCatalogo } from '../inventario.service';

const MAXIMO_RESULTADOS = 8;

/** Sin acentos y en minúsculas, para comparar lo escrito con códigos y nombres. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

interface Opcion {
  pieza: PiezaCatalogo | null;
  /** Ya está en la entrada: elegirla suma a su cantidad. */
  enEntrada: boolean;
}

/**
 * Busca una pieza del inventario por código, código de barras o nombre (sobre el catálogo ya cargado).
 * Elegirla emite `elegida`; si no existe, la última opción emite `crear` con lo escrito.
 */
@Component({
  selector: 'app-buscador-pieza',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <label [for]="idControl()" class="mb-1 block text-sm font-medium text-slate-700">
      Buscar pieza por código o nombre
    </label>
    <div class="relative">
      <app-icono
        nombre="buscar"
        [tamano]="16"
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
      />
      <input
        #campo
        type="text"
        class="control pl-9"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        placeholder="Ej. FIL-001 o filtro de aceite"
        [id]="idControl()"
        [attr.aria-expanded]="abierto()"
        [attr.aria-controls]="idLista"
        aria-autocomplete="list"
        [attr.aria-activedescendant]="abierto() ? idLista + '-' + activa() : null"
        [value]="texto()"
        (input)="escribir($any($event.target).value)"
        (keydown)="teclado($event)"
        (focus)="enfocado.set(true)"
        (blur)="enfocado.set(false)"
      />
    </div>

    @if (abierto()) {
      <ul
        [id]="idLista"
        role="listbox"
        class="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
      >
        @for (opcion of opciones(); track $index; let i = $index) {
          <li
            [id]="idLista + '-' + i"
            role="option"
            [attr.aria-selected]="i === activa()"
            class="cursor-pointer px-3 py-2"
            [class.bg-slate-100]="i === activa()"
            (mousedown)="$event.preventDefault()"
            (mouseenter)="activa.set(i)"
            (click)="elegir(opcion)"
          >
            @if (opcion.pieza; as p) {
              <span class="flex items-center justify-between gap-3">
                <span class="min-w-0">
                  <span class="block truncate font-medium text-slate-900">{{ p.nombre }}</span>
                  <span class="block font-mono text-xs text-slate-500">
                    {{ p.codigo }}{{ p.codigoBarras ? ' · ' + p.codigoBarras : '' }}
                  </span>
                </span>
                <span class="shrink-0 text-right text-xs">
                  <span class="block text-slate-500"
                    >Existencia {{ p.existencia }} {{ p.unidadMedida }}</span
                  >
                  @if (opcion.enEntrada) {
                    <span class="font-medium text-primario">En la entrada · suma 1</span>
                  }
                </span>
              </span>
            } @else {
              <span class="flex items-center gap-2 font-medium text-primario">
                <app-icono nombre="mas" [tamano]="16" />
                Registrar nueva pieza «{{ texto().trim() }}»
              </span>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class BuscadorPieza {
  readonly piezas = input.required<PiezaCatalogo[]>();
  /** Ids de las piezas que ya están en la entrada. */
  readonly enEntrada = input<string[]>([]);
  readonly idControl = input('buscar-pieza');

  readonly elegida = output<PiezaCatalogo>();
  readonly crear = output<string>();

  protected readonly idLista = 'resultados-pieza';
  protected readonly texto = signal('');
  protected readonly activa = signal(0);
  protected readonly enfocado = signal(false);

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  /** Coincidencias exactas de código primero, luego las que empiezan por lo escrito y el resto. */
  protected readonly opciones = computed<Opcion[]>(() => {
    const termino = normalizar(this.texto());
    if (!termino) return [];
    const enEntrada = new Set(this.enEntrada());

    const puntaje = (p: PiezaCatalogo): number => {
      const codigo = normalizar(p.codigo);
      const barras = normalizar(p.codigoBarras ?? '');
      const nombre = normalizar(p.nombre);
      if (codigo === termino || barras === termino) return 0;
      if (codigo.startsWith(termino) || nombre.startsWith(termino)) return 1;
      if (codigo.includes(termino) || barras.includes(termino) || nombre.includes(termino))
        return 2;
      return -1;
    };

    const encontradas = this.piezas()
      .map((p) => ({ p, puntaje: puntaje(p) }))
      .filter((x) => x.puntaje >= 0)
      .sort((a, b) => a.puntaje - b.puntaje || a.p.nombre.localeCompare(b.p.nombre))
      .slice(0, MAXIMO_RESULTADOS)
      .map<Opcion>((x) => ({ pieza: x.p, enEntrada: enEntrada.has(x.p.id) }));

    // Si el código escrito ya existe no se ofrece registrarlo de nuevo.
    const existeCodigo = this.piezas().some((p) => normalizar(p.codigo) === termino);
    return existeCodigo ? encontradas : [...encontradas, { pieza: null, enEntrada: false }];
  });

  protected readonly abierto = computed(() => this.enfocado() && this.opciones().length > 0);

  /** Lleva el foco al buscador (ej. después de agregar una pieza). */
  enfocar(): void {
    this.campo().nativeElement.focus();
  }

  protected escribir(texto: string): void {
    this.texto.set(texto);
    this.activa.set(0);
  }

  protected teclado(evento: KeyboardEvent): void {
    const total = this.opciones().length;
    switch (evento.key) {
      case 'ArrowDown':
        if (!total) return;
        evento.preventDefault();
        this.activa.update((i) => (i + 1) % total);
        break;
      case 'ArrowUp':
        if (!total) return;
        evento.preventDefault();
        this.activa.update((i) => (i - 1 + total) % total);
        break;
      case 'Enter':
        // Enter no envía el formulario: elige la opción resaltada.
        evento.preventDefault();
        if (total) this.elegir(this.opciones()[this.activa()]);
        break;
      case 'Escape':
        if (this.texto()) {
          evento.preventDefault();
          this.texto.set('');
        }
        break;
    }
  }

  protected elegir(opcion: Opcion): void {
    if (opcion.pieza) this.elegida.emit(opcion.pieza);
    else this.crear.emit(this.texto().trim());
    this.texto.set('');
    this.activa.set(0);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, Subject, catchError, debounce, map, of, switchMap, tap, timer } from 'rxjs';
import {
  CargoSipffaa,
  DepartamentoSipffaa,
  MiembroSipffaa,
  SipffaaService,
} from '../../core/sipffaa/sipffaa.service';
import { Icono } from '../ui/icono/icono';

export type TipoBusquedaSipffaa = 'miembro' | 'departamento' | 'cargo';
export type ElementoSipffaa = MiembroSipffaa | DepartamentoSipffaa | CargoSipffaa;

interface Opcion {
  clave: string;
  titulo: string;
  detalle: string;
  /** Ya registrado en el sistema (no consultado en SIPFFAA). */
  registrado: boolean;
  valor: ElementoSipffaa;
}

interface Busqueda {
  texto: string;
  soloSipffaa: boolean;
}

const MINIMO_CARACTERES = 3;
const ESPERA_MS = 300;
const PLACEHOLDER: Record<TipoBusquedaSipffaa, string> = {
  miembro: 'Buscar por nombre o cédula',
  departamento: 'Buscar departamento por nombre',
  cargo: 'Buscar cargo por nombre',
};

let siguienteId = 0;

/** Texto que muestra el campo cuando hay un elemento elegido. */
export function etiquetaSipffaa(tipo: TipoBusquedaSipffaa, valor: ElementoSipffaa): string {
  switch (tipo) {
    case 'miembro': {
      const m = valor as MiembroSipffaa;
      return `${m.rangoAbreviado ? m.rangoAbreviado + ' ' : ''}${m.nombreCompleto} (${m.cedula})`;
    }
    case 'departamento':
      return (valor as DepartamentoSipffaa).nombre;
    case 'cargo':
      return (valor as CargoSipffaa).nombre;
  }
}

/**
 * Campo con autocompletado para elegir un miembro (por nombre o cédula), un departamento o un cargo.
 * Busca primero en el histórico del sistema y, si no hay coincidencias, en SIPFFAA; cuando los
 * resultados vienen del histórico ofrece "Buscar en SIPFFAA" para ampliar. Funciona como control de
 * formulario: su valor es el elemento elegido (MiembroSipffaa, DepartamentoSipffaa o CargoSipffaa) o
 * null. Escribir de nuevo descarta la elección.
 *
 * ```html
 * <app-buscador-sipffaa tipo="miembro" idControl="solicitante" formControlName="solicitante" />
 * ```
 */
@Component({
  selector: 'app-buscador-sipffaa',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: BuscadorSipffaa, multi: true }],
  host: { class: 'relative block' },
  template: `
    <div class="relative">
      <app-icono
        nombre="buscar"
        [tamano]="16"
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
      />
      <input
        #campo
        type="text"
        class="control pr-9 pl-9"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        [attr.id]="idControl()"
        [attr.aria-expanded]="abierto()"
        [attr.aria-controls]="idLista"
        aria-autocomplete="list"
        [attr.aria-activedescendant]="activa() >= 0 ? idLista + '-' + activa() : null"
        [placeholder]="placeholder()"
        [value]="texto()"
        [disabled]="deshabilitado()"
        (input)="escribir($any($event.target).value)"
        (keydown)="teclado($event)"
        (focus)="enfocar()"
        (blur)="cerrar()"
      />
      @if (cargando()) {
        <span
          class="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-300 border-t-primario"
          aria-hidden="true"
        ></span>
      } @else if (seleccion() && !deshabilitado()) {
        <button
          type="button"
          class="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          (mousedown)="$event.preventDefault()"
          (click)="limpiar()"
          aria-label="Quitar selección"
        >
          <app-icono nombre="cerrar" [tamano]="14" />
        </button>
      }
    </div>

    @if (abierto()) {
      <ul
        [id]="idLista"
        role="listbox"
        class="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
      >
        @for (opcion of opciones(); track opcion.clave; let i = $index) {
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
            <span class="flex items-center gap-2 font-medium text-slate-900">
              {{ opcion.titulo }}
              @if (opcion.registrado) {
                <span
                  class="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600 ring-1 ring-slate-500/20 ring-inset"
                  title="Ya registrado en el sistema"
                >
                  Registrado
                </span>
              }
            </span>
            @if (opcion.detalle) {
              <span class="block text-xs text-slate-500">{{ opcion.detalle }}</span>
            }
          </li>
        } @empty {
          <li class="px-3 py-2 text-slate-500" role="presentation">
            @if (error()) {
              No se pudo consultar SIPFFAA. Intente de nuevo.
            } @else {
              Sin resultados{{ soloSipffaa() ? ' en SIPFFAA' : '' }} para «{{ texto() }}».
            }
          </li>
        }
        @if (puedeAmpliar()) {
          <li
            [id]="idLista + '-' + opciones().length"
            role="option"
            [attr.aria-selected]="activa() === opciones().length"
            class="flex cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2 text-primario"
            [class.bg-slate-100]="activa() === opciones().length"
            (mousedown)="$event.preventDefault()"
            (mouseenter)="activa.set(opciones().length)"
            (click)="ampliar()"
          >
            <app-icono nombre="buscar" [tamano]="14" />
            ¿No está en la lista? Buscar en SIPFFAA
          </li>
        }
      </ul>
    }
  `,
})
export class BuscadorSipffaa implements ControlValueAccessor {
  private readonly sipffaa = inject(SipffaaService);

  readonly tipo = input.required<TipoBusquedaSipffaa>();
  readonly idControl = input<string>();
  readonly maximo = input(10);

  protected readonly idLista = `buscador-sipffaa-${siguienteId++}`;
  protected readonly placeholder = computed(() => PLACEHOLDER[this.tipo()]);

  protected readonly texto = signal('');
  protected readonly seleccion = signal<ElementoSipffaa | null>(null);
  protected readonly opciones = signal<Opcion[]>([]);
  protected readonly activa = signal(-1);
  protected readonly cargando = signal(false);
  protected readonly error = signal(false);
  protected readonly buscado = signal(false);
  protected readonly enfocado = signal(false);
  protected readonly deshabilitado = signal(false);
  /** La última búsqueda omitió el histórico. */
  protected readonly soloSipffaa = signal(false);

  /** Los resultados vienen del histórico: se puede consultar SIPFFAA para ver más. */
  protected readonly puedeAmpliar = computed(
    () => !this.soloSipffaa() && !this.error() && this.opciones().some((o) => o.registrado),
  );

  /** Opciones más la entrada "Buscar en SIPFFAA", para la navegación con el teclado. */
  private readonly totalNavegable = computed(
    () => this.opciones().length + (this.puedeAmpliar() ? 1 : 0),
  );

  /** La lista se muestra tras una búsqueda, mientras el campo tiene el foco y no hay elección. */
  protected readonly abierto = computed(
    () => this.enfocado() && this.buscado() && !this.cargando() && !this.seleccion(),
  );

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  private readonly busquedas = new Subject<Busqueda>();
  private alCambiar: (valor: ElementoSipffaa | null) => void = () => {};
  private alTocar: () => void = () => {};

  constructor() {
    this.busquedas
      .pipe(
        // "Buscar en SIPFFAA" es una acción explícita: no espera como la escritura.
        debounce((b) => timer(b.soloSipffaa ? 0 : ESPERA_MS)),
        tap((b) => {
          this.cargando.set(!!b.texto);
          this.error.set(false);
          this.soloSipffaa.set(b.soloSipffaa);
        }),
        switchMap((b) =>
          this.consultar(b).pipe(
            catchError(() => {
              this.error.set(true);
              return of([] as Opcion[]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((opciones) => {
        this.opciones.set(opciones);
        this.activa.set(opciones.length ? 0 : -1);
        this.cargando.set(false);
        this.buscado.set(true);
      });
  }

  writeValue(valor: ElementoSipffaa | null): void {
    this.seleccion.set(valor ?? null);
    this.texto.set(valor ? etiquetaSipffaa(this.tipo(), valor) : '');
    this.buscado.set(false);
  }

  registerOnChange(fn: (valor: ElementoSipffaa | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected escribir(texto: string): void {
    this.texto.set(texto);
    if (this.seleccion()) {
      this.seleccion.set(null);
      this.alCambiar(null);
    }

    const termino = texto.trim();
    if (termino.length < MINIMO_CARACTERES) {
      this.buscado.set(false);
      this.opciones.set([]);
      this.busquedas.next({ texto: '', soloSipffaa: false });
      return;
    }
    this.busquedas.next({ texto: termino, soloSipffaa: false });
  }

  /** Repite la búsqueda solo en SIPFFAA. */
  protected ampliar(): void {
    const termino = this.texto().trim();
    if (termino.length >= MINIMO_CARACTERES) {
      this.busquedas.next({ texto: termino, soloSipffaa: true });
    }
  }

  protected teclado(evento: KeyboardEvent): void {
    const total = this.totalNavegable();
    switch (evento.key) {
      case 'ArrowDown':
        if (!this.abierto() || total === 0) return;
        evento.preventDefault();
        this.activa.update((i) => (i + 1) % total);
        break;
      case 'ArrowUp':
        if (!this.abierto() || total === 0) return;
        evento.preventDefault();
        this.activa.update((i) => (i - 1 + total) % total);
        break;
      case 'Enter':
        if (this.abierto() && this.activa() >= 0) {
          evento.preventDefault();
          if (this.activa() < this.opciones().length) this.elegir(this.opciones()[this.activa()]);
          else this.ampliar();
        }
        break;
      case 'Escape':
        if (this.abierto()) {
          evento.preventDefault();
          this.buscado.set(false);
        }
        break;
    }
  }

  protected enfocar(): void {
    this.enfocado.set(true);
  }

  protected cerrar(): void {
    this.enfocado.set(false);
    this.alTocar();
  }

  protected elegir(opcion: Opcion): void {
    this.seleccion.set(opcion.valor);
    this.texto.set(etiquetaSipffaa(this.tipo(), opcion.valor));
    this.buscado.set(false);
    this.alCambiar(opcion.valor);
  }

  protected limpiar(): void {
    this.seleccion.set(null);
    this.texto.set('');
    this.opciones.set([]);
    this.buscado.set(false);
    this.alCambiar(null);
    this.campo().nativeElement.focus();
  }

  /** Una búsqueda vacía (texto corto) cancela la anterior sin consultar. */
  private consultar({ texto, soloSipffaa }: Busqueda): Observable<Opcion[]> {
    if (!texto) return of([]);
    const maximo = this.maximo();

    switch (this.tipo()) {
      case 'miembro':
        return this.sipffaa.buscarMiembros(texto, maximo, soloSipffaa).pipe(
          map((miembros) =>
            miembros.map((m) => ({
              clave: m.cedula,
              registrado: m.origen === 'Historico',
              titulo: `${m.rangoAbreviado ? m.rangoAbreviado + ' ' : ''}${m.nombreCompleto}`,
              detalle: [m.cedula, m.cargo, m.departamento].filter(Boolean).join(' · '),
              valor: m,
            })),
          ),
        );
      case 'departamento':
        return this.sipffaa.buscarDepartamentos(texto, maximo, soloSipffaa).pipe(
          map((departamentos) =>
            departamentos.map((d) => ({
              clave: `${d.codDepartamento}`,
              registrado: d.origen === 'Historico',
              titulo: d.nombre,
              detalle: d.departamentoPadre
                ? `Pertenece a: ${d.departamentoPadre}`
                : (d.descripcion ?? ''),
              valor: d,
            })),
          ),
        );
      case 'cargo':
        return this.sipffaa.buscarCargos(texto, maximo, soloSipffaa).pipe(
          map((cargos) =>
            cargos.map((c) => ({
              clave: `${c.codCargo}`,
              registrado: c.origen === 'Historico',
              titulo: c.nombre,
              // Los del histórico no traen ocupantes: no se sabe si está vacante.
              detalle:
                c.origen === 'Historico'
                  ? ''
                  : c.cantidadOcupantes === 0
                    ? 'Vacante'
                    : c.cantidadOcupantes === 1
                      ? `Ocupado por ${c.ocupantes[0]?.rango ?? ''} ${c.ocupantes[0]?.nombreCompleto ?? ''}`.replace(
                          /\s+/g,
                          ' ',
                        )
                      : `${c.cantidadOcupantes} ocupantes`,
              valor: c,
            })),
          ),
        );
    }
  }
}

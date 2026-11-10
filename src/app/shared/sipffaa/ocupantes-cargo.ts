import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import {
  CargoSipffaa,
  MiembroSipffaa,
  OcupanteCargoSipffaa,
  SipffaaService,
} from '../../core/sipffaa/sipffaa.service';

const soloDigitos = (cedula: string) => cedula.replace(/\D/g, '');

/**
 * Ocupantes actuales de un cargo (SIPFFAA) para elegir con un clic a la persona que actúa en su nombre.
 * Un cargo del histórico no trae ocupantes: se consultan en SIPFFAA por código e institución.
 * Al elegir uno emite el miembro completo (rango, departamento) buscado por su cédula.
 */
@Component({
  selector: 'app-ocupantes-cargo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (cargando()) {
      <p class="text-xs text-slate-500">Buscando quién ocupa el cargo…</p>
    } @else if (error()) {
      <p class="text-xs text-amber-700">
        No se pudieron consultar los ocupantes del cargo; busque a la persona por cédula o nombre.
      </p>
    } @else if (ocupantes().length === 0) {
      <p class="text-xs text-slate-500">
        El cargo no tiene ocupantes registrados en SIPFFAA (vacante o interino); busque a la persona
        por cédula o nombre.
      </p>
    } @else {
      <p class="mb-1 text-xs text-slate-500">
        {{ ocupantes().length === 1 ? 'Ocupa el cargo:' : 'Ocupan el cargo:' }}
      </p>
      <ul class="flex flex-wrap gap-2">
        @for (o of ocupantes(); track o.cedula) {
          <li>
            <button
              type="button"
              class="rounded-md border px-2.5 py-1 text-left text-xs hover:border-primario"
              [class.border-primario]="soloDigitos(o.cedula) === seleccionada()"
              [class.bg-slate-50]="soloDigitos(o.cedula) === seleccionada()"
              [class.border-slate-200]="soloDigitos(o.cedula) !== seleccionada()"
              [attr.aria-pressed]="soloDigitos(o.cedula) === seleccionada()"
              [disabled]="resolviendo()"
              (click)="elegir(o)"
            >
              <span class="block font-medium text-slate-900">
                {{ o.rango ? o.rango + ' ' : '' }}{{ o.nombreCompleto }}
              </span>
              <span class="block font-mono text-slate-500">
                {{ o.cedula }}{{ o.departamento ? ' · ' + o.departamento : '' }}
              </span>
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class OcupantesCargo {
  private readonly sipffaa = inject(SipffaaService);

  readonly cargo = input.required<CargoSipffaa>();
  /** Cédula de la persona elegida actualmente, para resaltarla. */
  readonly cedulaSeleccionada = input<string | null>(null);
  /** Con un solo ocupante, lo elige sin esperar el clic. */
  readonly elegirUnico = input(false);

  readonly elegido = output<MiembroSipffaa>();

  protected readonly soloDigitos = soloDigitos;
  protected readonly ocupantes = signal<OcupanteCargoSipffaa[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal(false);
  protected readonly resolviendo = signal(false);
  protected readonly seleccionada = () => soloDigitos(this.cedulaSeleccionada() ?? '');

  constructor() {
    effect((onCleanup) => {
      const cargo = this.cargo();
      let vigente = true;
      onCleanup(() => (vigente = false));
      this.error.set(false);

      if (cargo.ocupantes.length > 0 || cargo.origen === 'Sipffaa') {
        this.mostrar(cargo.ocupantes);
        return;
      }
      // Del histórico: se busca el cargo en SIPFFAA para conocer sus ocupantes actuales.
      this.cargando.set(true);
      this.sipffaa
        .buscarCargos(cargo.nombre, 20, true)
        .pipe(
          map(
            (cargos) =>
              cargos.find(
                (c) => c.codCargo === cargo.codCargo && c.codInstitucion === cargo.codInstitucion,
              )?.ocupantes ?? [],
          ),
          catchError(() => {
            if (vigente) this.error.set(true);
            return of([]);
          }),
        )
        .subscribe((ocupantes) => {
          if (!vigente) return;
          this.cargando.set(false);
          this.mostrar(ocupantes);
        });
    });
  }

  private mostrar(ocupantes: OcupanteCargoSipffaa[]): void {
    this.ocupantes.set(ocupantes);
    if (this.elegirUnico() && ocupantes.length === 1 && !this.cedulaSeleccionada()) {
      void this.elegir(ocupantes[0]);
    }
  }

  protected async elegir(ocupante: OcupanteCargoSipffaa): Promise<void> {
    const cedula = soloDigitos(ocupante.cedula);
    this.resolviendo.set(true);
    try {
      const buscar = (soloSipffaa: boolean) =>
        firstValueFrom(
          this.sipffaa.buscarMiembros(cedula, 5, soloSipffaa).pipe(
            map((ms) => ms.find((m) => soloDigitos(m.cedula) === cedula) ?? null),
            catchError(() => of(null)),
          ),
        );
      const miembro = (await buscar(false)) ?? (await buscar(true));
      if (miembro) this.elegido.emit(miembro);
      else this.error.set(true);
    } finally {
      this.resolviendo.set(false);
    }
  }
}

import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { EstadoVacio } from '../../../shared/ui/estado-vacio/estado-vacio';
import { CambioPagina, Paginador } from '../../../shared/ui/paginador/paginador';
import { Celda, Columna, Tabla } from '../../../shared/ui/tabla/tabla';
import {
  AsignacionResumen,
  ESTATUS_ASIGNACION,
  EstatusAsignacion,
} from '../../asignaciones/asignaciones.service';
import { VehiculosService, nombreEstatusVehiculo } from '../vehiculos.service';

type Vista = 'asignaciones' | 'mantenimientos';

/**
 * Historial del vehículo: sus asignaciones y sus entradas al taller. La vista, el estado y la página
 * viven en la URL (?vista=&estatus=&pagina=&tamano=).
 */
@Component({
  selector: 'app-vehiculo-historial',
  imports: [
    DatePipe,
    RouterLink,
    EncabezadoPagina,
    Tabla,
    Celda,
    Paginador,
    EstadoBadge,
    EstadoVacio,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehiculo-historial.html',
})
export class VehiculoHistorial {
  private readonly vehiculos = inject(VehiculosService);
  private readonly router = inject(Router);

  // Parámetros de la ruta y de la URL (withComponentInputBinding).
  readonly id = input.required<string>();
  readonly vista = input<Vista, string | undefined>('asignaciones', {
    transform: (v) => (v === 'mantenimientos' ? 'mantenimientos' : 'asignaciones'),
  });
  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly estatus = input<EstatusAsignacion | null, string | undefined>(null, {
    transform: (v) =>
      ESTATUS_ASIGNACION.includes(v as EstatusAsignacion) ? (v as EstatusAsignacion) : null,
  });

  protected readonly nombreEstatus = nombreEstatusVehiculo;
  protected readonly estados = ESTATUS_ASIGNACION;
  protected readonly columnas: Columna[] = [
    { clave: 'periodo', titulo: 'Período' },
    { clave: 'asignado', titulo: 'Asignado a' },
    { clave: 'chofer', titulo: 'Chofer', ocultarEnMovil: true },
    { clave: 'destino', titulo: 'Destino / propósito', ocultarEnMovil: true },
    { clave: 'estatus', titulo: 'Estado' },
  ];

  protected readonly vehiculo = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => this.vehiculos.obtener(id).pipe(catchError(() => of(null)))),
    ),
  );

  protected readonly filas = signal<AsignacionResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  private readonly filtro = computed(() => ({
    id: this.id(),
    pagina: this.pagina(),
    tamano: this.tamano(),
    estatus: this.estatus(),
  }));

  constructor() {
    toObservable(this.filtro)
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap(({ id, ...filtro }) =>
          this.vehiculos.asignaciones(id, filtro).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.filas.set(resultado?.rows ?? []);
        this.total.set(resultado?.totalRecords ?? 0);
        this.cargando.set(false);
      });
  }

  protected cambiarVista(vista: Vista): void {
    this.navegar({ vista: vista === 'asignaciones' ? null : vista, estatus: null, pagina: null });
  }

  protected filtrarEstatus(estatus: string): void {
    this.navegar({ estatus: estatus || null, pagina: null });
  }

  protected paginar({ pagina, tamano }: CambioPagina): void {
    this.navegar({ pagina: pagina > 1 ? pagina : null, tamano: tamano !== 20 ? tamano : null });
  }

  private navegar(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: cambios, queryParamsHandling: 'merge' });
  }
}

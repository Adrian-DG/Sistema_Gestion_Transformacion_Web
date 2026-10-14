import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, filter, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Permiso } from '../../../core/auth/permisos';
import { DialogosService } from '../../../core/dialogos/dialogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { EstadoVacio } from '../../../shared/ui/estado-vacio/estado-vacio';
import { Icono } from '../../../shared/ui/icono/icono';
import { CambioPagina, Paginador } from '../../../shared/ui/paginador/paginador';
import { Celda, Columna, Tabla } from '../../../shared/ui/tabla/tabla';
import {
  AsignacionResumen,
  ESTATUS_ASIGNACION,
  EstatusAsignacion,
} from '../../asignaciones/asignaciones.service';
import { moneda } from '../../inventario/inventario.service';
import {
  HistorialMantenimientos,
  PiezaUtilizada,
  SolicitudTaller,
  TallerService,
  nombreEstatus as nombreEstatusTaller,
  nombreTipo,
} from '../../taller/taller.service';
import { VehiculoDetalle, VehiculosService, nombreEstatusVehiculo } from '../vehiculos.service';

type Vista = 'asignaciones' | 'mantenimientos';

/** Entrada de la línea de tiempo de mantenimientos: una solicitud de taller o una reactivación. */
type EventoMantenimiento =
  | { tipo: 'solicitud'; fecha: string; solicitud: SolicitudTaller; piezas: PiezaUtilizada[] }
  | { tipo: 'reactivacion'; fecha: string; motivo: string; autorizadoPor: string };

/**
 * Historial del vehículo: sus asignaciones y sus mantenimientos (entradas al taller con las piezas
 * utilizadas, y reactivaciones). La vista, el estado y la página viven en la URL
 * (?vista=&estatus=&pagina=&tamano=). Desde aquí se envía al taller o, si está inactivo y el usuario
 * tiene el permiso, se reactiva por excepción.
 */
@Component({
  selector: 'app-vehiculo-historial',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    EncabezadoPagina,
    Tabla,
    Celda,
    Paginador,
    EstadoBadge,
    EstadoVacio,
    Cargando,
    Icono,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehiculo-historial.html',
})
export class VehiculoHistorial {
  private readonly vehiculos = inject(VehiculosService);
  private readonly taller = inject(TallerService);
  private readonly auth = inject(AuthService);
  private readonly dialogos = inject(DialogosService);
  private readonly notificaciones = inject(NotificacionesService);
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
  protected readonly nombreEstatusTaller = nombreEstatusTaller;
  protected readonly nombreTipo = nombreTipo;
  protected readonly moneda = moneda;
  protected readonly estados = ESTATUS_ASIGNACION;
  protected readonly columnas: Columna[] = [
    { clave: 'periodo', titulo: 'Período' },
    { clave: 'asignado', titulo: 'Asignado a' },
    { clave: 'chofer', titulo: 'Chofer', ocultarEnMovil: true },
    { clave: 'destino', titulo: 'Destino / propósito', ocultarEnMovil: true },
    { clave: 'estatus', titulo: 'Estado' },
  ];

  protected readonly puedeEnviarATaller = computed(() => this.auth.tiene(Permiso.GestionTaller));
  protected readonly puedeReactivar = computed(() => this.auth.tiene(Permiso.ReactivarVehiculos));

  private readonly recarga = signal(0);
  protected readonly vehiculo = signal<VehiculoDetalle | null>(null);
  protected readonly historial = signal<HistorialMantenimientos | null>(null);
  protected readonly procesando = signal(false);

  protected readonly filas = signal<AsignacionResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  /** Solicitudes de taller y reactivaciones, la más reciente primero. */
  protected readonly eventos = computed<EventoMantenimiento[]>(() => {
    const h = this.historial();
    if (!h) return [];
    const eventos: EventoMantenimiento[] = [
      ...h.solicitudes.map((s) => ({
        tipo: 'solicitud' as const,
        fecha: s.solicitud.fechaIngreso ?? s.solicitud.fechaSolicitud,
        solicitud: s.solicitud,
        piezas: s.piezas,
      })),
      ...h.reactivaciones.map((r) => ({
        tipo: 'reactivacion' as const,
        fecha: r.fecha,
        motivo: r.motivo,
        autorizadoPor: r.autorizadoPor,
      })),
    ];
    return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  protected readonly costoTotal = computed(() =>
    (this.historial()?.solicitudes ?? []).reduce((t, s) => t + s.solicitud.costoPiezas, 0),
  );

  private readonly filtro = computed(() => ({
    id: this.id(),
    pagina: this.pagina(),
    tamano: this.tamano(),
    estatus: this.estatus(),
  }));

  constructor() {
    combineLatest([toObservable(this.id), toObservable(this.recarga)])
      .pipe(
        switchMap(([id]) => this.vehiculos.obtener(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((v) => this.vehiculo.set(v));

    combineLatest([toObservable(this.id), toObservable(this.vista), toObservable(this.recarga)])
      .pipe(
        filter(([, vista]) => vista === 'mantenimientos'),
        tap(() => this.historial.set(null)),
        switchMap(([id]) => this.taller.historial(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((h) => this.historial.set(h ?? { solicitudes: [], reactivaciones: [] }));

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

  protected async reactivar(): Promise<void> {
    const v = this.vehiculo();
    if (!v) return;
    const motivo = await this.dialogos.solicitarMotivo({
      titulo: 'Reactivar vehículo',
      mensaje: `El vehículo ${v.placa} fue dado de baja. Al reactivarlo vuelve a estar disponible; la reactivación queda en su historial de mantenimientos a su nombre.`,
      textoConfirmar: 'Reactivar',
      motivo: { etiqueta: 'Justificación de la excepción', maximo: 1000 },
    });
    if (!motivo) return;

    this.procesando.set(true);
    try {
      await firstValueFrom(this.taller.reactivarVehiculo(v.id, motivo));
      this.notificaciones.exito(`Vehículo ${v.placa} reactivado.`);
      this.recarga.update((n) => n + 1);
    } catch {
      // El interceptor ya mostró el aviso.
    } finally {
      this.procesando.set(false);
    }
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

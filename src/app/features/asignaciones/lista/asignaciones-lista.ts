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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { DialogosService } from '../../../core/dialogos/dialogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { Icono } from '../../../shared/ui/icono/icono';
import { CambioPagina, Paginador } from '../../../shared/ui/paginador/paginador';
import { Celda, Columna, Tabla } from '../../../shared/ui/tabla/tabla';
import {
  AsignacionResumen,
  AsignacionesService,
  ESTATUS_ASIGNACION,
  EstatusAsignacion,
} from '../asignaciones.service';

const ESPERA_BUSQUEDA_MS = 350;

/** Fecha y hora local sin zona (yyyy-MM-ddTHH:mm:ss), como la espera la API. */
function ahoraLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Solicitudes y asignaciones de vehículos. Los filtros viven en la URL (?q=&estatus=&pagina=&tamano=).
 * Ninguna se elimina: se rechazan o cancelan con un motivo.
 */
@Component({
  selector: 'app-asignaciones-lista',
  imports: [DatePipe, RouterLink, EncabezadoPagina, Tabla, Celda, Paginador, EstadoBadge, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asignaciones-lista.html',
})
export class AsignacionesLista {
  private readonly asignaciones = inject(AsignacionesService);
  private readonly dialogos = inject(DialogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  // Parámetros de la URL (withComponentInputBinding).
  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly estatus = input<EstatusAsignacion | null, string | undefined>(null, {
    transform: (v) => (ESTATUS_ASIGNACION.includes(v as EstatusAsignacion) ? (v as EstatusAsignacion) : null),
  });

  protected readonly estados = ESTATUS_ASIGNACION;
  protected readonly columnas: Columna[] = [
    { clave: 'vehiculo', titulo: 'Vehículo' },
    { clave: 'asignado', titulo: 'Asignado a' },
    { clave: 'solicitante', titulo: 'Solicitante', ocultarEnMovil: true },
    { clave: 'chofer', titulo: 'Chofer', ocultarEnMovil: true },
    { clave: 'periodo', titulo: 'Período', ocultarEnMovil: true },
    { clave: 'estatus', titulo: 'Estado' },
    { clave: 'acciones', titulo: '', alineacion: 'derecha', ocultarEnMovil: true },
  ];

  protected readonly filas = signal<AsignacionResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal<string | null>(null);

  private readonly filtro = computed(() => ({
    pagina: this.pagina(),
    tamano: this.tamano(),
    busqueda: this.q().trim(),
    estatus: this.estatus(),
  }));

  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;
  private readonly recargar = signal(0);

  constructor() {
    toObservable(computed(() => ({ filtro: this.filtro(), recarga: this.recargar() })))
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap(({ filtro }) =>
          this.asignaciones.listar(filtro).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.filas.set(resultado?.rows ?? []);
        this.total.set(resultado?.totalRecords ?? 0);
        this.cargando.set(false);
      });
  }

  /** Aprobada cuyo retorno estimado ya pasó sin registrarse la entrada del vehículo. */
  protected retornoVencido(a: AsignacionResumen): boolean {
    return a.estatus === 'Aprobada' && new Date(a.fechaRetornoEstimada) < new Date();
  }

  protected async aprobar(a: AsignacionResumen): Promise<void> {
    const confirmado = await this.dialogos.confirmar({
      titulo: 'Aprobar asignación',
      mensaje: `El vehículo ${a.placa} quedará reservado para ${a.asignadoA} durante el período solicitado.`,
      textoConfirmar: 'Aprobar',
    });
    if (confirmado) await this.ejecutar(a, this.asignaciones.aprobar(a.id), 'Asignación aprobada.');
  }

  protected async rechazar(a: AsignacionResumen): Promise<void> {
    const motivo = await this.dialogos.solicitarMotivo({
      titulo: 'Rechazar asignación',
      mensaje: `La solicitud del vehículo ${a.placa} para ${a.asignadoA} quedará rechazada.`,
      textoConfirmar: 'Rechazar',
      tipo: 'peligro',
      motivo: { etiqueta: 'Motivo del rechazo', maximo: 500 },
    });
    if (motivo) {
      await this.ejecutar(a, this.asignaciones.rechazar(a.id, motivo), 'Asignación rechazada.');
    }
  }

  protected async cancelar(a: AsignacionResumen): Promise<void> {
    const motivo = await this.dialogos.solicitarMotivo({
      titulo: 'Cancelar asignación',
      mensaje: 'Use esta opción para anular una asignación registrada por error. Quedará en el historial como cancelada.',
      textoConfirmar: 'Cancelar asignación',
      textoCancelar: 'Volver',
      tipo: 'peligro',
      motivo: { etiqueta: 'Motivo de la cancelación', maximo: 500 },
    });
    if (motivo) {
      await this.ejecutar(a, this.asignaciones.cancelar(a.id, motivo), 'Asignación cancelada.');
    }
  }

  protected async registrarRetorno(a: AsignacionResumen): Promise<void> {
    const confirmado = await this.dialogos.confirmar({
      titulo: 'Registrar retorno',
      mensaje: `Se registrará la entrada del vehículo ${a.placa} a la base con la fecha y hora actuales, y la asignación quedará finalizada.`,
      textoConfirmar: 'Registrar retorno',
    });
    if (confirmado) {
      await this.ejecutar(
        a,
        this.asignaciones.registrarRetorno(a.id, ahoraLocal()),
        'Retorno registrado. La asignación quedó finalizada.',
      );
    }
  }

  protected buscar(texto: string): void {
    clearTimeout(this.temporizadorBusqueda);
    this.temporizadorBusqueda = setTimeout(
      () => this.navegar({ q: texto.trim() || null, pagina: null }),
      ESPERA_BUSQUEDA_MS,
    );
  }

  protected filtrarEstatus(estatus: string): void {
    this.navegar({ estatus: estatus || null, pagina: null });
  }

  protected paginar({ pagina, tamano }: CambioPagina): void {
    this.navegar({ pagina: pagina > 1 ? pagina : null, tamano: tamano !== 20 ? tamano : null });
  }

  private async ejecutar(a: AsignacionResumen, accion: Observable<void>, mensaje: string): Promise<void> {
    this.procesando.set(a.id);
    try {
      await firstValueFrom(accion);
      this.notificaciones.exito(mensaje);
      this.recargar.update((n) => n + 1);
    } catch (e) {
      // El interceptor ya mostró el aviso (ej. vehículo ocupado, estado inválido).
      if (!esApiError(e)) throw e;
    } finally {
      this.procesando.set(null);
    }
  }

  private navegar(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: cambios, queryParamsHandling: 'merge' });
  }
}

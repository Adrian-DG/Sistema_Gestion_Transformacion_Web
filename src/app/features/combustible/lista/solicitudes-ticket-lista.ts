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
  CombustibleService,
  ESTATUS_SOLICITUD_TICKET,
  EstatusSolicitudTicket,
  Existencia,
  NOMBRE_COMBUSTIBLE,
  SolicitudTicketResumen,
} from '../combustible.service';

const ESPERA_BUSQUEDA_MS = 350;

/**
 * Asignación de combustible mediante tickets: existencia por tipo y solicitudes con sus tickets.
 * Los filtros viven en la URL (?q=&estatus=&pagina=&tamano=). Ninguna solicitud se elimina: se
 * rechaza o cancela con un motivo y sus tickets quedan anulados.
 */
@Component({
  selector: 'app-solicitudes-ticket-lista',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    EncabezadoPagina,
    Tabla,
    Celda,
    Paginador,
    EstadoBadge,
    Icono,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitudes-ticket-lista.html',
})
export class SolicitudesTicketLista {
  private readonly combustible = inject(CombustibleService);
  private readonly dialogos = inject(DialogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  // Parámetros de la URL (withComponentInputBinding).
  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly estatus = input<EstatusSolicitudTicket | null, string | undefined>(null, {
    transform: (v) =>
      ESTATUS_SOLICITUD_TICKET.includes(v as EstatusSolicitudTicket)
        ? (v as EstatusSolicitudTicket)
        : null,
  });

  protected readonly estados = ESTATUS_SOLICITUD_TICKET;
  protected readonly nombreCombustible = NOMBRE_COMBUSTIBLE;
  protected readonly columnas: Columna[] = [
    { clave: 'tickets', titulo: 'Tickets' },
    { clave: 'entregado', titulo: 'Entregados a' },
    { clave: 'solicitante', titulo: 'Solicitante', ocultarEnMovil: true },
    { clave: 'fecha', titulo: 'Solicitud', ocultarEnMovil: true },
    { clave: 'estatus', titulo: 'Estado' },
    { clave: 'acciones', titulo: '', alineacion: 'derecha', ocultarEnMovil: true },
  ];

  protected readonly filas = signal<SolicitudTicketResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal<string | null>(null);
  protected readonly existencias = signal<Existencia[] | null>(null);

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
          this.combustible.listarSolicitudes(filtro).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.filas.set(resultado?.rows ?? []);
        this.total.set(resultado?.totalRecords ?? 0);
        this.cargando.set(false);
      });

    // La existencia cambia al aprobar o anular tickets: se consulta de nuevo con cada recarga.
    toObservable(this.recargar)
      .pipe(
        switchMap(() => this.combustible.existencia().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((existencias) => this.existencias.set(existencias ?? []));
  }

  /** Primer y último número: la API los genera consecutivos dentro de cada solicitud. */
  protected rango(s: SolicitudTicketResumen): string {
    const numeros = s.tickets.map((t) => t.numero);
    if (numeros.length <= 1) return numeros[0] ?? '—';
    return `${numeros[0]} – ${numeros[numeros.length - 1]}`;
  }

  /** Ej. "3 × 5 gal Gasolina, 2 × 10 gal Gasoil". */
  protected detalle(s: SolicitudTicketResumen): string {
    const grupos = new Map<string, number>();
    for (const t of s.tickets) {
      const clave = `${t.galones} gal ${t.tipoCombustible}`;
      grupos.set(clave, (grupos.get(clave) ?? 0) + 1);
    }
    return [...grupos].map(([clave, n]) => `${n} × ${clave}`).join(', ');
  }

  protected utilizados(s: SolicitudTicketResumen): number {
    return s.tickets.filter((t) => t.estatus === 'Utilizado').length;
  }

  protected async aprobar(s: SolicitudTicketResumen): Promise<void> {
    const confirmado = await this.dialogos.confirmar({
      titulo: 'Aprobar solicitud',
      mensaje: `Se habilitarán ${s.tickets.length} ticket(s) (${s.totalGalones} gal) para ${s.entregadoA}. Los galones quedan comprometidos hasta que se utilicen.`,
      textoConfirmar: 'Aprobar',
    });
    if (confirmado) {
      await this.ejecutar(s, this.combustible.aprobar(s.id), 'Solicitud aprobada. Los tickets están disponibles.');
    }
  }

  protected async rechazar(s: SolicitudTicketResumen): Promise<void> {
    const motivo = await this.dialogos.solicitarMotivo({
      titulo: 'Rechazar solicitud',
      mensaje: `La solicitud de ${s.solicitante} quedará rechazada y sus tickets anulados.`,
      textoConfirmar: 'Rechazar',
      tipo: 'peligro',
      motivo: { etiqueta: 'Motivo del rechazo', maximo: 500 },
    });
    if (motivo) {
      await this.ejecutar(s, this.combustible.rechazar(s.id, motivo), 'Solicitud rechazada.');
    }
  }

  protected async cancelar(s: SolicitudTicketResumen): Promise<void> {
    const motivo = await this.dialogos.solicitarMotivo({
      titulo: 'Cancelar solicitud',
      mensaje:
        'Use esta opción para anular una solicitud registrada por error. Sus tickets quedarán anulados y la solicitud en el historial como cancelada.',
      textoConfirmar: 'Cancelar solicitud',
      textoCancelar: 'Volver',
      tipo: 'peligro',
      motivo: { etiqueta: 'Motivo de la cancelación', maximo: 500 },
    });
    if (motivo) {
      await this.ejecutar(s, this.combustible.cancelar(s.id, motivo), 'Solicitud cancelada.');
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

  private async ejecutar(s: SolicitudTicketResumen, accion: Observable<void>, mensaje: string): Promise<void> {
    this.procesando.set(s.id);
    try {
      await firstValueFrom(accion);
      this.notificaciones.exito(mensaje);
      this.recargar.update((n) => n + 1);
    } catch (e) {
      // El interceptor ya mostró el aviso (ej. existencia insuficiente, tickets utilizados).
      if (!esApiError(e)) throw e;
    } finally {
      this.procesando.set(null);
    }
  }

  private navegar(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: cambios, queryParamsHandling: 'merge' });
  }
}

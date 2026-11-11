import { DatePipe, DecimalPipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { Permiso } from '../../../core/auth/permisos';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { Icono } from '../../../shared/ui/icono/icono';
import { abrirArchivo } from '../../inventario/inventario.service';
import {
  AdjuntoSolicitudTicket,
  CombustibleService,
  EstatusTicket,
  SolicitudTicketDetalle as Detalle,
} from '../combustible.service';

type FiltroTickets = 'Todos' | 'Utilizados' | 'Pendientes' | 'Anulados';

const ESTATUS_FILTRO: Record<Exclude<FiltroTickets, 'Todos'>, EstatusTicket[]> = {
  Utilizados: ['Utilizado'],
  Pendientes: ['Disponible', 'Reservado'],
  Anulados: ['Anulado'],
};

/**
 * Detalle de una solicitud de tickets: a quién se asignó, galones por tipo de combustible y cada
 * ticket con su estado; los utilizados muestran la fecha y hora del despacho, el operador y quién
 * recibió.
 */
@Component({
  selector: 'app-solicitud-ticket-detalle',
  imports: [
    DatePipe,
    DecimalPipe,
    LowerCasePipe,
    RouterLink,
    Cargando,
    EncabezadoPagina,
    EstadoBadge,
    Icono,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitud-ticket-detalle.html',
})
export class SolicitudTicketDetalle {
  private readonly combustible = inject(CombustibleService);
  private readonly auth = inject(AuthService);

  /** Id de la ruta (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly detalle = signal<Detalle | null>(null);
  protected readonly cargando = signal(true);
  protected readonly noEncontrada = signal(false);
  protected readonly imprimiendo = signal(false);

  protected readonly filtros: FiltroTickets[] = ['Todos', 'Utilizados', 'Pendientes', 'Anulados'];
  protected readonly filtro = signal<FiltroTickets>('Todos');

  protected readonly puedeImprimir = computed(() => {
    const d = this.detalle();
    return (
      !!d &&
      d.estatus === 'Aprobada' &&
      d.tickets.some((t) => t.estatus === 'Disponible') &&
      this.auth.tiene(Permiso.GestionCombustible)
    );
  });

  protected readonly ticketsFiltrados = computed(() => {
    const tickets = this.detalle()?.tickets ?? [];
    const filtro = this.filtro();
    return filtro === 'Todos'
      ? tickets
      : tickets.filter((t) => ESTATUS_FILTRO[filtro].includes(t.estatus));
  });

  protected cantidad(filtro: FiltroTickets): number {
    const tickets = this.detalle()?.tickets ?? [];
    return filtro === 'Todos'
      ? tickets.length
      : tickets.filter((t) => ESTATUS_FILTRO[filtro].includes(t.estatus)).length;
  }

  /** Porcentaje utilizado, para la barra de avance. */
  protected porcentaje(utilizado: number, total: number): number {
    return total > 0 ? Math.round((utilizado / total) * 100) : 0;
  }

  constructor() {
    toObservable(this.id)
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap((id) => this.combustible.solicitud(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((detalle) => {
        this.detalle.set(detalle);
        this.noEncontrada.set(detalle === null);
        this.cargando.set(false);
      });
  }

  protected async verAdjunto(a: AdjuntoSolicitudTicket): Promise<void> {
    abrirArchivo(await firstValueFrom(this.combustible.adjunto(a.id)));
  }

  /** PDF con los tickets disponibles (código de barras para el despacho). */
  protected async imprimir(): Promise<void> {
    const d = this.detalle();
    if (!d) return;
    this.imprimiendo.set(true);
    try {
      const pdf = await firstValueFrom(this.combustible.imprimirTickets(d.id));
      const url = URL.createObjectURL(pdf);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `Tickets_${d.tickets[0]?.numero ?? d.id}.pdf`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // El interceptor ya mostró el aviso.
      if (!esApiError(e)) throw e;
    } finally {
      this.imprimiendo.set(false);
    }
  }
}

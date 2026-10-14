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
import { catchError, of, switchMap, tap } from 'rxjs';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { Icono } from '../../../shared/ui/icono/icono';
import { CambioPagina, Paginador } from '../../../shared/ui/paginador/paginador';
import { Celda, Columna, Tabla } from '../../../shared/ui/tabla/tabla';
import { moneda } from '../../inventario/inventario.service';
import {
  ESTATUS_SOLICITUD,
  SolicitudTaller,
  TIPOS_SOLICITUD,
  TallerService,
  nombreEstatus,
  nombreTipo,
} from '../taller.service';

const ESPERA_BUSQUEDA_MS = 350;

const valorDe = (lista: readonly { valor: number; codigo: string }[], codigo: string | undefined) =>
  lista.find((e) => e.codigo === codigo)?.valor ?? null;

/**
 * Solicitudes de taller, la más reciente primero. Los filtros viven en la URL
 * (?q=&estatus=&tipo=&pagina=&tamano=); estatus y tipo usan el código, ej. ?estatus=EnTaller.
 */
@Component({
  selector: 'app-solicitudes-taller-lista',
  imports: [DatePipe, RouterLink, EncabezadoPagina, Tabla, Celda, Paginador, EstadoBadge, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitudes-taller-lista.html',
})
export class SolicitudesTallerLista {
  private readonly taller = inject(TallerService);
  private readonly router = inject(Router);

  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly estatus = input<string | undefined>();
  readonly tipo = input<string | undefined>();

  protected readonly estados = ESTATUS_SOLICITUD;
  protected readonly tipos = TIPOS_SOLICITUD;
  protected readonly nombreEstatus = nombreEstatus;
  protected readonly nombreTipo = nombreTipo;
  protected readonly moneda = moneda;
  protected readonly columnas: Columna[] = [
    { clave: 'numero', titulo: 'Solicitud' },
    { clave: 'vehiculo', titulo: 'Vehículo' },
    { clave: 'motivo', titulo: 'Motivo', ocultarEnMovil: true },
    { clave: 'mecanico', titulo: 'Mecánico', ocultarEnMovil: true },
    { clave: 'estatus', titulo: 'Estado' },
  ];

  protected readonly filas = signal<SolicitudTaller[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  private readonly filtro = computed(() => ({
    pagina: this.pagina(),
    tamano: this.tamano(),
    busqueda: this.q().trim(),
    estatus: valorDe(ESTATUS_SOLICITUD, this.estatus()),
    tipo: valorDe(TIPOS_SOLICITUD, this.tipo()),
  }));

  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;

  constructor() {
    toObservable(this.filtro)
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap((filtro) => this.taller.solicitudes(filtro).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.filas.set(resultado?.rows ?? []);
        this.total.set(resultado?.totalRecords ?? 0);
        this.cargando.set(false);
      });
  }

  protected buscar(texto: string): void {
    clearTimeout(this.temporizadorBusqueda);
    this.temporizadorBusqueda = setTimeout(
      () => this.navegar({ q: texto.trim() || null, pagina: null }),
      ESPERA_BUSQUEDA_MS,
    );
  }

  protected filtrar(clave: 'estatus' | 'tipo', valor: string): void {
    this.navegar({ [clave]: valor || null, pagina: null });
  }

  protected paginar({ pagina, tamano }: CambioPagina): void {
    this.navegar({ pagina: pagina > 1 ? pagina : null, tamano: tamano !== 20 ? tamano : null });
  }

  private navegar(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: cambios, queryParamsHandling: 'merge' });
  }
}

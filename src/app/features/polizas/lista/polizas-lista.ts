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
import { NOMBRE_COBERTURA, PolizaResumen, PolizasService } from '../polizas.service';

const ESPERA_BUSQUEDA_MS = 350;

/**
 * Pólizas, las de vencimiento más reciente primero. Los filtros viven en la URL (?q=&pagina=&tamano=).
 */
@Component({
  selector: 'app-polizas-lista',
  imports: [DatePipe, RouterLink, EncabezadoPagina, Tabla, Celda, Paginador, EstadoBadge, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './polizas-lista.html',
})
export class PolizasLista {
  private readonly polizas = inject(PolizasService);
  private readonly router = inject(Router);

  // Parámetros de la URL (withComponentInputBinding).
  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });

  protected readonly columnas: Columna[] = [
    { clave: 'numero', titulo: 'Póliza' },
    { clave: 'vehiculo', titulo: 'Vehículo' },
    { clave: 'vigencia', titulo: 'Vigencia', ocultarEnMovil: true },
    { clave: 'cobertura', titulo: 'Cobertura' },
    { clave: 'acciones', titulo: '', alineacion: 'derecha', ocultarEnMovil: true },
  ];

  protected readonly filas = signal<PolizaResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  private readonly filtro = computed(() => ({
    pagina: this.pagina(),
    tamano: this.tamano(),
    busqueda: this.q().trim(),
  }));

  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;

  constructor() {
    toObservable(this.filtro)
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap((filtro) => this.polizas.listar(filtro).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.filas.set(resultado?.rows ?? []);
        this.total.set(resultado?.totalRecords ?? 0);
        this.cargando.set(false);
      });
  }

  protected nombreCobertura(poliza: PolizaResumen): string {
    return NOMBRE_COBERTURA[poliza.cobertura] ?? poliza.cobertura;
  }

  /** "Vence en 12 días", "Vence hoy", "Venció hace 3 días". */
  protected diasTexto(dias: number): string {
    if (dias > 1) return `Vence en ${dias} días`;
    if (dias === 1) return 'Vence mañana';
    if (dias === 0) return 'Vence hoy';
    return dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`;
  }

  protected buscar(texto: string): void {
    clearTimeout(this.temporizadorBusqueda);
    this.temporizadorBusqueda = setTimeout(
      () => this.navegar({ q: texto.trim() || null, pagina: null }),
      ESPERA_BUSQUEDA_MS,
    );
  }

  protected paginar({ pagina, tamano }: CambioPagina): void {
    this.navegar({ pagina: pagina > 1 ? pagina : null, tamano: tamano !== 20 ? tamano : null });
  }

  private navegar(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: cambios, queryParamsHandling: 'merge' });
  }
}

import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { LectorCodigoBarras } from '../../../shared/formularios/lector-codigo-barras';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { Icono } from '../../../shared/ui/icono/icono';
import { CambioPagina, Paginador } from '../../../shared/ui/paginador/paginador';
import { Celda, Columna, Tabla } from '../../../shared/ui/tabla/tabla';
import { InventarioService, Pieza } from '../inventario.service';

const ESPERA_BUSQUEDA_MS = 350;

/** Piezas con su existencia. Los filtros viven en la URL (?q=&bajoMinimo=&pagina=&tamano=). */
@Component({
  selector: 'app-piezas-lista',
  imports: [
    DecimalPipe,
    RouterLink,
    EncabezadoPagina,
    Tabla,
    Celda,
    Paginador,
    EstadoBadge,
    Icono,
    LectorCodigoBarras,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './piezas-lista.html',
})
export class PiezasLista {
  private readonly inventario = inject(InventarioService);
  private readonly router = inject(Router);

  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly bajoMinimo = input(false, { transform: booleanAttribute });

  protected readonly columnas: Columna[] = [
    { clave: 'pieza', titulo: 'Pieza' },
    { clave: 'existencia', titulo: 'Existencia', alineacion: 'derecha' },
    { clave: 'minima', titulo: 'Mínima', alineacion: 'derecha', ocultarEnMovil: true },
    { clave: 'estado', titulo: 'Estado' },
    { clave: 'acciones', titulo: '', alineacion: 'derecha', ocultarEnMovil: true },
  ];

  protected readonly filas = signal<Pieza[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  private readonly filtro = computed(() => ({
    pagina: this.pagina(),
    tamano: this.tamano(),
    busqueda: this.q().trim(),
    soloBajoMinimo: this.bajoMinimo(),
    activo: null,
  }));

  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;

  constructor() {
    toObservable(this.filtro)
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap((filtro) => this.inventario.piezas(filtro).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.filas.set(resultado?.rows ?? []);
        this.total.set(resultado?.totalRecords ?? 0);
        this.cargando.set(false);
      });
  }

  /** El código escaneado filtra de inmediato (también busca por código de barras). */
  protected escanear(codigo: string): void {
    clearTimeout(this.temporizadorBusqueda);
    this.navegar({ q: codigo, pagina: null });
  }

  protected buscar(texto: string): void {
    clearTimeout(this.temporizadorBusqueda);
    this.temporizadorBusqueda = setTimeout(
      () => this.navegar({ q: texto.trim() || null, pagina: null }),
      ESPERA_BUSQUEDA_MS,
    );
  }

  protected filtrarBajoMinimo(activo: boolean): void {
    this.navegar({ bajoMinimo: activo ? 'true' : null, pagina: null });
  }

  protected paginar({ pagina, tamano }: CambioPagina): void {
    this.navegar({ pagina: pagina > 1 ? pagina : null, tamano: tamano !== 20 ? tamano : null });
  }

  private navegar(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: cambios, queryParamsHandling: 'merge' });
  }
}

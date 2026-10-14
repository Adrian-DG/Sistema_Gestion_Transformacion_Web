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
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { CambioPagina, Paginador } from '../../../shared/ui/paginador/paginador';
import { Celda, Columna, Tabla } from '../../../shared/ui/tabla/tabla';
import {
  AdjuntoResumen,
  EntradaPieza,
  InventarioService,
  abrirArchivo,
  moneda,
} from '../inventario.service';

const ESPERA_BUSQUEDA_MS = 350;

/** Compras de piezas al inventario, la más reciente primero (?q=&pagina=&tamano=). */
@Component({
  selector: 'app-entradas-lista',
  imports: [DatePipe, DecimalPipe, RouterLink, EncabezadoPagina, Tabla, Celda, Paginador, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entradas-lista.html',
})
export class EntradasLista {
  private readonly inventario = inject(InventarioService);
  private readonly router = inject(Router);

  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });

  protected readonly moneda = moneda;
  protected readonly columnas: Columna[] = [
    { clave: 'fecha', titulo: 'Fecha' },
    { clave: 'proveedor', titulo: 'Proveedor / factura' },
    { clave: 'lineas', titulo: 'Piezas', ocultarEnMovil: true },
    { clave: 'total', titulo: 'Total', alineacion: 'derecha' },
    { clave: 'adjuntos', titulo: '', alineacion: 'derecha', ocultarEnMovil: true },
  ];

  protected readonly filas = signal<EntradaPieza[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;

  constructor() {
    toObservable(
      computed(() => ({ pagina: this.pagina(), tamano: this.tamano(), busqueda: this.q().trim() })),
    )
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap((filtro) => this.inventario.entradas(filtro).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.filas.set(resultado?.rows ?? []);
        this.total.set(resultado?.totalRecords ?? 0);
        this.cargando.set(false);
      });
  }

  protected async verAdjunto(a: AdjuntoResumen): Promise<void> {
    abrirArchivo(await firstValueFrom(this.inventario.adjunto(a.id)));
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

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
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { CambioPagina, Paginador } from '../../../shared/ui/paginador/paginador';
import { Celda, Columna, Tabla } from '../../../shared/ui/tabla/tabla';
import { InventarioService, MovimientoPieza, NOMBRE_CONCEPTO, moneda } from '../inventario.service';

/** Kardex de la pieza: entradas, compras directas, consumos en el taller y devoluciones. */
@Component({
  selector: 'app-pieza-kardex',
  imports: [DatePipe, DecimalPipe, RouterLink, EncabezadoPagina, Tabla, Celda, Paginador, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pieza-kardex.html',
})
export class PiezaKardex {
  private readonly inventario = inject(InventarioService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });

  protected readonly nombreConcepto = (c: string): string =>
    NOMBRE_CONCEPTO[c as keyof typeof NOMBRE_CONCEPTO] ?? c;
  protected readonly moneda = moneda;
  protected readonly columnas: Columna[] = [
    { clave: 'fecha', titulo: 'Fecha' },
    { clave: 'concepto', titulo: 'Concepto' },
    { clave: 'cantidad', titulo: 'Cantidad', alineacion: 'derecha' },
    { clave: 'costo', titulo: 'Costo unitario', alineacion: 'derecha', ocultarEnMovil: true },
    { clave: 'referencia', titulo: 'Referencia', ocultarEnMovil: true },
  ];

  protected readonly pieza = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => this.inventario.obtenerPieza(id).pipe(catchError(() => of(null)))),
    ),
  );

  protected readonly filas = signal<MovimientoPieza[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  constructor() {
    toObservable(computed(() => ({ id: this.id(), pagina: this.pagina(), tamano: this.tamano() })))
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap(({ id, ...filtro }) =>
          this.inventario.movimientos(id, filtro).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.filas.set(resultado?.rows ?? []);
        this.total.set(resultado?.totalRecords ?? 0);
        this.cargando.set(false);
      });
  }

  protected paginar({ pagina, tamano }: CambioPagina): void {
    void this.router.navigate([], {
      queryParams: { pagina: pagina > 1 ? pagina : null, tamano: tamano !== 20 ? tamano : null },
      queryParamsHandling: 'merge',
    });
  }
}

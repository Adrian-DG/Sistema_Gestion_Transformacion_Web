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
import { InventarioService, Proveedor } from '../inventario.service';

const ESPERA_BUSQUEDA_MS = 350;

/** Suplidores de piezas (?q=&pagina=&tamano=). No se eliminan: se desactivan. */
@Component({
  selector: 'app-proveedores-lista',
  imports: [RouterLink, EncabezadoPagina, Tabla, Celda, Paginador, EstadoBadge, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-encabezado-pagina
      seccion="Taller"
      titulo="Proveedores"
      descripcion="Suplidores de piezas para las entradas al inventario y las compras directas del taller."
    >
      <a routerLink="nuevo" class="btn btn-primario">
        <app-icono nombre="mas" [tamano]="18" /> Nuevo proveedor
      </a>
    </app-encabezado-pagina>

    <div class="tarjeta overflow-hidden">
      <div class="border-b border-slate-200 p-4">
        <label class="relative block">
          <span class="sr-only">Buscar proveedores</span>
          <app-icono
            nombre="buscar"
            [tamano]="18"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            class="control pl-10"
            placeholder="Buscar por nombre, RNC o contacto"
            [value]="q()"
            (input)="buscar($any($event.target).value)"
          />
        </label>
      </div>

      <app-tabla
        [columnas]="columnas"
        [filas]="filas()"
        [cargando]="cargando()"
        [mensajeVacio]="
          q() ? 'Ningún proveedor coincide con la búsqueda' : 'No hay proveedores registrados'
        "
      >
        <ng-template appCelda="nombre" let-p>
          <a
            [routerLink]="[p.id, 'editar']"
            class="font-semibold text-slate-900 hover:text-primario hover:underline"
            >{{ p.nombre }}</a
          >
          @if (p.rnc) {
            <span class="block font-mono text-xs text-slate-500">RNC {{ p.rnc }}</span>
          }
        </ng-template>
        <ng-template appCelda="contacto" let-p>
          <span class="block">{{ p.contacto || '—' }}</span>
          <span class="block text-xs text-slate-500">
            {{ p.telefono }}{{ p.telefono && p.correo ? ' · ' : '' }}{{ p.correo }}
          </span>
        </ng-template>
        <ng-template appCelda="estado" let-p>
          <div class="flex flex-wrap gap-1">
            <app-estado-badge [estado]="p.activo ? 'Activo' : 'Inactivo'" />
            @if (p.esTallerAutorizado) {
              <app-estado-badge estado="Taller autorizado" />
            }
          </div>
        </ng-template>
        <ng-template appCelda="acciones" let-p>
          <a [routerLink]="[p.id, 'editar']" class="btn btn-texto btn-sm">Editar</a>
        </ng-template>
      </app-tabla>

      <app-paginador
        [pagina]="pagina()"
        [tamano]="tamano()"
        [total]="total()"
        (cambio)="paginar($event)"
      />
    </div>
  `,
})
export class ProveedoresLista {
  private readonly inventario = inject(InventarioService);
  private readonly router = inject(Router);

  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });

  protected readonly columnas: Columna[] = [
    { clave: 'nombre', titulo: 'Proveedor' },
    { clave: 'contacto', titulo: 'Contacto', ocultarEnMovil: true },
    { clave: 'estado', titulo: 'Estado' },
    { clave: 'acciones', titulo: '', alineacion: 'derecha', ocultarEnMovil: true },
  ];

  protected readonly filas = signal<Proveedor[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;

  constructor() {
    toObservable(
      computed(() => ({
        pagina: this.pagina(),
        tamano: this.tamano(),
        busqueda: this.q().trim(),
        activo: null,
      })),
    )
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap((filtro) => this.inventario.proveedores(filtro).pipe(catchError(() => of(null)))),
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

  protected paginar({ pagina, tamano }: CambioPagina): void {
    this.navegar({ pagina: pagina > 1 ? pagina : null, tamano: tamano !== 20 ? tamano : null });
  }

  private navegar(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: cambios, queryParamsHandling: 'merge' });
  }
}

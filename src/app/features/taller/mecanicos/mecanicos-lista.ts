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
import { Mecanico, TallerService } from '../taller.service';

const ESPERA_BUSQUEDA_MS = 350;

/** Personal del taller, militar o civil (?q=&pagina=&tamano=). No se eliminan: se desactivan. */
@Component({
  selector: 'app-mecanicos-lista',
  imports: [RouterLink, EncabezadoPagina, Tabla, Celda, Paginador, EstadoBadge, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-encabezado-pagina
      seccion="Taller"
      titulo="Mecánicos"
      descripcion="Personal que atiende las solicitudes de taller. Los militares se buscan en SIPFFAA; los civiles se registran a mano."
    >
      <a routerLink="nuevo" class="btn btn-primario">
        <app-icono nombre="mas" [tamano]="18" /> Nuevo mecánico
      </a>
    </app-encabezado-pagina>

    <div class="tarjeta overflow-hidden">
      <div class="border-b border-slate-200 p-4">
        <label class="relative block">
          <span class="sr-only">Buscar mecánicos</span>
          <app-icono
            nombre="buscar"
            [tamano]="18"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            class="control pl-10"
            placeholder="Buscar por nombre, cédula o especialidad"
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
          q() ? 'Ningún mecánico coincide con la búsqueda' : 'No hay mecánicos registrados'
        "
      >
        <ng-template appCelda="nombre" let-m>
          <span class="block text-slate-900">
            @if (m.rango) {
              <span class="text-slate-500">{{ m.rango }}</span>
            }
            {{ m.nombreCompleto }}
          </span>
          <span class="block font-mono text-xs text-slate-500">{{ m.identificacion }}</span>
        </ng-template>
        <ng-template appCelda="tipo" let-m>
          <span class="block">{{ m.tipoPersona }}</span>
          <span class="block text-xs text-slate-500">{{ m.telefono }}</span>
        </ng-template>
        <ng-template appCelda="especialidad" let-m>{{ m.especialidad ?? '—' }}</ng-template>
        <ng-template appCelda="carga" let-m>
          @if (m.solicitudesEnTaller > 0) {
            <a
              routerLink="/taller"
              [queryParams]="{ estatus: 'EnTaller', q: m.nombreCompleto }"
              class="text-primario hover:underline"
              >{{ m.solicitudesEnTaller }} en taller</a
            >
          } @else {
            <span class="text-slate-500">Libre</span>
          }
        </ng-template>
        <ng-template appCelda="estado" let-m>
          <app-estado-badge [estado]="m.activo ? 'Activo' : 'Inactivo'" />
        </ng-template>
        <ng-template appCelda="acciones" let-m>
          <a [routerLink]="[m.id, 'editar']" class="btn btn-texto btn-sm">Editar</a>
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
export class MecanicosLista {
  private readonly taller = inject(TallerService);
  private readonly router = inject(Router);

  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });

  protected readonly columnas: Columna[] = [
    { clave: 'nombre', titulo: 'Mecánico' },
    { clave: 'tipo', titulo: 'Tipo', ocultarEnMovil: true },
    { clave: 'especialidad', titulo: 'Especialidad', ocultarEnMovil: true },
    { clave: 'carga', titulo: 'Órdenes' },
    { clave: 'estado', titulo: 'Estado' },
    { clave: 'acciones', titulo: '', alineacion: 'derecha', ocultarEnMovil: true },
  ];

  protected readonly filas = signal<Mecanico[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);

  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;

  constructor() {
    toObservable(
      computed(() => ({ pagina: this.pagina(), tamano: this.tamano(), busqueda: this.q().trim() })),
    )
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap((filtro) => this.taller.mecanicos(filtro).pipe(catchError(() => of(null)))),
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

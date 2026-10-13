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
import { esApiError } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogosService } from '../../../core/dialogos/dialogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { nombreInstitucion } from '../../../shared/catalogos/enumeraciones';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { Icono } from '../../../shared/ui/icono/icono';
import { CambioPagina, Paginador } from '../../../shared/ui/paginador/paginador';
import { Celda, Columna, Tabla } from '../../../shared/ui/tabla/tabla';
import { nombrePermiso } from '../selector-permisos/selector-permisos';
import { UsuarioResumen, UsuariosService } from '../usuarios.service';

type FiltroEstado = '' | 'activos' | 'inactivos';

const ESPERA_BUSQUEDA_MS = 350;

/**
 * Listado de usuarios. Los filtros viven en la URL (?q=&estado=&pagina=&tamano=), así se conservan
 * al volver del detalle y se pueden compartir.
 */
@Component({
  selector: 'app-usuarios-lista',
  imports: [RouterLink, EncabezadoPagina, Tabla, Celda, Paginador, EstadoBadge, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuarios-lista.html',
})
export class UsuariosLista {
  private readonly usuarios = inject(UsuariosService);
  private readonly router = inject(Router);
  private readonly dialogos = inject(DialogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly auth = inject(AuthService);

  // Parámetros de la URL (withComponentInputBinding).
  readonly pagina = input(1, { transform: (v: unknown) => Math.max(1, numberAttribute(v, 1)) });
  readonly tamano = input(20, {
    transform: (v: unknown) => Math.min(100, Math.max(1, numberAttribute(v, 20))),
  });
  readonly q = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly estado = input<FiltroEstado, string | undefined>('', {
    transform: (v) => (v === 'activos' || v === 'inactivos' ? v : ''),
  });

  protected readonly columnas: Columna[] = [
    { clave: 'usuario', titulo: 'Usuario' },
    { clave: 'identificacion', titulo: 'Identificación', ocultarEnMovil: true },
    { clave: 'institucion', titulo: 'Institución / rango', ocultarEnMovil: true },
    { clave: 'permisos', titulo: 'Permisos', ocultarEnMovil: true },
    { clave: 'estado', titulo: 'Estado' },
    { clave: 'acciones', titulo: '', alineacion: 'derecha', ocultarEnMovil: true },
  ];

  protected readonly filas = signal<UsuarioResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly procesando = signal<string | null>(null);
  protected readonly idActual = computed(() => this.auth.usuario()?.id ?? null);

  protected readonly nombreInstitucion = nombreInstitucion;
  protected readonly nombrePermiso = nombrePermiso;

  private readonly filtro = computed(() => ({
    pagina: this.pagina(),
    tamano: this.tamano(),
    busqueda: this.q().trim(),
    activo: this.estado() === '' ? null : this.estado() === 'activos',
  }));

  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;
  private readonly recargar = signal(0);

  constructor() {
    toObservable(computed(() => ({ filtro: this.filtro(), recarga: this.recargar() })))
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap(({ filtro }) => this.usuarios.listar(filtro).pipe(catchError(() => of(null)))),
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

  protected filtrarEstado(estado: string): void {
    this.navegar({ estado: estado || null, pagina: null });
  }

  protected paginar({ pagina, tamano }: CambioPagina): void {
    this.navegar({ pagina: pagina > 1 ? pagina : null, tamano: tamano !== 20 ? tamano : null });
  }

  protected async cambiarEstado(usuario: UsuarioResumen): Promise<void> {
    const activar = !usuario.activo;
    const confirmado = await this.dialogos.confirmar({
      titulo: activar ? 'Activar usuario' : 'Desactivar usuario',
      mensaje: activar
        ? `${usuario.nombreCompleto} podrá iniciar sesión nuevamente.`
        : `${usuario.nombreCompleto} no podrá iniciar sesión hasta que se active otra vez.`,
      textoConfirmar: activar ? 'Activar' : 'Desactivar',
      tipo: activar ? 'primario' : 'peligro',
    });
    if (!confirmado) return;

    this.procesando.set(usuario.id);
    try {
      await firstValueFrom(this.usuarios.cambiarEstado(usuario.id, activar));
      this.notificaciones.exito(activar ? 'Usuario activado.' : 'Usuario desactivado.');
      this.recargar.update((n) => n + 1);
    } catch (e) {
      // El interceptor ya mostró el aviso (ej. último administrador).
      if (!esApiError(e)) throw e;
    } finally {
      this.procesando.set(null);
    }
  }

  private navegar(cambios: Record<string, string | number | null>): void {
    void this.router.navigate([], { queryParams: cambios, queryParamsHandling: 'merge' });
  }
}

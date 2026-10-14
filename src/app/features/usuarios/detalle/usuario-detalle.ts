import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { ApiError, esApiError } from '../../../core/api/api';
import { AuthService } from '../../../core/auth/auth.service';
import { Permiso } from '../../../core/auth/permisos';
import { DialogosService } from '../../../core/dialogos/dialogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { nombreInstitucion } from '../../../shared/catalogos/enumeraciones';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { EstadoVacio } from '../../../shared/ui/estado-vacio/estado-vacio';
import { Icono } from '../../../shared/ui/icono/icono';
import { nombrePermiso } from '../selector-permisos/selector-permisos';
import { UsuarioDetalle, UsuariosService } from '../usuarios.service';

/** Consulta del usuario; sus datos y permisos se modifican en la pantalla de edición. */
@Component({
  selector: 'app-usuario-detalle',
  imports: [RouterLink, EncabezadoPagina, EstadoBadge, EstadoVacio, Cargando, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuario-detalle.html',
})
export class UsuarioDetalleComponent {
  private readonly usuarios = inject(UsuariosService);
  private readonly dialogos = inject(DialogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LOCALE_ID);

  /** Parámetro de la ruta. */
  readonly id = input.required<string>();

  protected readonly usuario = signal<UsuarioDetalle | null>(null);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cambiandoEstado = signal(false);

  /** Administrador primero; los demás por nombre. */
  protected readonly permisos = computed(() =>
    [...(this.usuario()?.roles ?? [])]
      .map((p) => ({ codigo: p, nombre: nombrePermiso(p) }))
      .sort((a, b) =>
        a.codigo === Permiso.Administrador
          ? -1
          : b.codigo === Permiso.Administrador
            ? 1
            : a.nombre.localeCompare(b.nombre),
      ),
  );
  protected readonly administrador: string = Permiso.Administrador;

  protected readonly datos = computed(() => {
    const u = this.usuario();
    if (!u) return [];
    return [
      { etiqueta: 'Identificación', valor: u.identificacion },
      { etiqueta: 'Nombre', valor: `${u.nombre} ${u.apellido}` },
      { etiqueta: 'Sexo', valor: u.sexo },
      { etiqueta: 'Institución', valor: nombreInstitucion(u.institucion) },
      { etiqueta: 'Rango', valor: u.rango ?? 'Sin rango' },
      { etiqueta: 'Usuario', valor: u.userName },
      { etiqueta: 'Correo', valor: u.email ?? '—' },
      { etiqueta: 'Teléfono', valor: u.telefono ?? '—' },
      {
        etiqueta: 'Registrado',
        valor: formatDate(u.fechaCreacion, "d 'de' MMMM 'de' y, h:mm a", this.locale),
      },
    ];
  });
  protected readonly esUsuarioActual = computed(
    () => this.usuario()?.id === this.auth.usuario()?.id,
  );

  private readonly recargar = signal(0);

  constructor() {
    toObservable(computed(() => ({ id: this.id(), recarga: this.recargar() })))
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap(({ id }) =>
          this.usuarios.obtener(id).pipe(
            catchError((e: unknown) => {
              this.error.set(esApiError(e) ? e : null);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((usuario) => {
        if (usuario) {
          this.usuario.set(usuario);
          this.error.set(null);
        }
        this.cargando.set(false);
      });
  }

  protected async cambiarEstado(): Promise<void> {
    const usuario = this.usuario();
    if (!usuario) return;

    const activar = !usuario.activo;
    const nombre = `${usuario.nombre} ${usuario.apellido}`;
    const confirmado = await this.dialogos.confirmar({
      titulo: activar ? 'Activar usuario' : 'Desactivar usuario',
      mensaje: activar
        ? `${nombre} podrá iniciar sesión nuevamente.`
        : `${nombre} no podrá iniciar sesión hasta que se active otra vez.`,
      textoConfirmar: activar ? 'Activar' : 'Desactivar',
      tipo: activar ? 'primario' : 'peligro',
    });
    if (!confirmado) return;

    this.cambiandoEstado.set(true);
    try {
      await firstValueFrom(this.usuarios.cambiarEstado(usuario.id, activar));
      this.notificaciones.exito(activar ? 'Usuario activado.' : 'Usuario desactivado.');
      this.recargar.update((n) => n + 1);
    } catch (e) {
      if (!esApiError(e)) throw e;
    } finally {
      this.cambiandoEstado.set(false);
    }
  }
}

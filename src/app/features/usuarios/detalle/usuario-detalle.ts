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
import { catchError, combineLatest, firstValueFrom, of, switchMap, tap } from 'rxjs';
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
import { SelectorPermisos } from '../selector-permisos/selector-permisos';
import { PermisoDisponible, UsuarioDetalle, UsuariosService } from '../usuarios.service';

@Component({
  selector: 'app-usuario-detalle',
  imports: [
    RouterLink,
    EncabezadoPagina,
    EstadoBadge,
    EstadoVacio,
    Cargando,
    Icono,
    SelectorPermisos,
  ],
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
  protected readonly disponibles = signal<PermisoDisponible[]>([]);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly cargando = signal(true);

  protected readonly permisos = signal<string[]>([]);
  protected readonly guardandoPermisos = signal(false);
  protected readonly cambiandoEstado = signal(false);

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

  /** Nadie puede quitarse a sí mismo el permiso de Administrador (lo exige también la API). */
  protected readonly bloqueados = computed(() =>
    this.esUsuarioActual() && this.usuario()?.roles.includes(Permiso.Administrador)
      ? [Permiso.Administrador as string]
      : [],
  );

  protected readonly permisosModificados = computed(() => {
    const originales = this.usuario()?.roles ?? [];
    const actuales = this.permisos();
    return originales.length !== actuales.length || originales.some((p) => !actuales.includes(p));
  });

  private readonly recargar = signal(0);

  constructor() {
    toObservable(computed(() => ({ id: this.id(), recarga: this.recargar() })))
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap(({ id }) =>
          combineLatest([this.usuarios.obtener(id), this.usuarios.permisos()]).pipe(
            catchError((e: unknown) => {
              this.error.set(esApiError(e) ? e : null);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        if (resultado) {
          const [usuario, disponibles] = resultado;
          this.usuario.set(usuario);
          this.disponibles.set(disponibles);
          this.permisos.set([...usuario.roles]);
          this.error.set(null);
        }
        this.cargando.set(false);
      });
  }

  protected descartarPermisos(): void {
    this.permisos.set([...(this.usuario()?.roles ?? [])]);
  }

  protected async guardarPermisos(): Promise<void> {
    const usuario = this.usuario();
    if (!usuario) return;

    if (this.permisos().length === 0) {
      const confirmado = await this.dialogos.confirmar({
        titulo: 'Quitar todos los permisos',
        mensaje: `${usuario.nombre} ${usuario.apellido} podrá iniciar sesión, pero no tendrá acceso a ningún módulo.`,
        textoConfirmar: 'Quitar permisos',
        tipo: 'peligro',
      });
      if (!confirmado) return;
    }

    this.guardandoPermisos.set(true);
    try {
      await firstValueFrom(this.usuarios.asignarPermisos(usuario.id, this.permisos()));
      this.notificaciones.exito(
        'Permisos actualizados. Se aplicarán cuando el usuario vuelva a iniciar sesión.',
      );
      this.recargar.update((n) => n + 1);
    } catch (e) {
      if (!esApiError(e)) throw e;
    } finally {
      this.guardandoPermisos.set(false);
    }
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

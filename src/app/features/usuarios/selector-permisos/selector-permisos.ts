import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { Permiso } from '../../../core/auth/permisos';
import { PermisoDisponible } from '../usuarios.service';

export const NOMBRES_PERMISO: Record<string, string> = {
  [Permiso.Administrador]: 'Administrador',
  [Permiso.GestionVehiculos]: 'Vehículos',
  [Permiso.GestionAsignaciones]: 'Asignaciones',
  [Permiso.GestionPolizas]: 'Pólizas',
  [Permiso.GestionCombustible]: 'Combustible',
  [Permiso.GestionPersonas]: 'Personas',
  [Permiso.GestionUsuarios]: 'Usuarios',
};

export const nombrePermiso = (permiso: string): string => NOMBRES_PERMISO[permiso] ?? permiso;

/**
 * Lista de permisos con casillas. Administrador va primero y, al marcarlo, indica que ya
 * cubre todos los módulos (los demás se pueden seguir marcando, pero no son necesarios).
 */
@Component({
  selector: 'app-selector-permisos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset [disabled]="deshabilitado()">
      <legend class="sr-only">Permisos</legend>
      <ul class="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
        @for (permiso of ordenados(); track permiso.nombre) {
          @let bloqueado = bloqueados().includes(permiso.nombre);
          <li>
            <label
              class="flex items-start gap-3 px-4 py-3"
              [class]="
                bloqueado ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-slate-50'
              "
            >
              <input
                type="checkbox"
                class="mt-0.5 size-4 rounded border-slate-300 accent-primario"
                [checked]="seleccion().includes(permiso.nombre)"
                [disabled]="bloqueado"
                (change)="alternar(permiso.nombre, $any($event.target).checked)"
              />
              <span class="flex-1">
                <span class="block text-sm font-medium text-slate-800">
                  {{ nombre(permiso.nombre) }}
                  @if (permiso.nombre === administrador && esAdministrador()) {
                    <span class="ml-1 text-xs font-normal text-secundario">· acceso total</span>
                  }
                </span>
                @if (permiso.descripcion) {
                  <span class="block text-xs text-slate-500">{{ permiso.descripcion }}</span>
                }
                @if (bloqueado && motivoBloqueo()) {
                  <span class="mt-0.5 block text-xs text-amber-700">{{ motivoBloqueo() }}</span>
                }
              </span>
            </label>
          </li>
        }
      </ul>
    </fieldset>
  `,
})
export class SelectorPermisos {
  readonly disponibles = input.required<PermisoDisponible[]>();
  readonly seleccion = model<string[]>([]);
  /** Permisos que no se pueden cambiar (ej. el propio Administrador). */
  readonly bloqueados = input<string[]>([]);
  readonly motivoBloqueo = input<string>();
  readonly deshabilitado = input(false);

  protected readonly administrador: string = Permiso.Administrador;
  protected readonly nombre = nombrePermiso;
  protected readonly esAdministrador = computed(() =>
    this.seleccion().includes(Permiso.Administrador),
  );

  protected readonly ordenados = computed(() =>
    [...this.disponibles()].sort((a, b) =>
      a.nombre === Permiso.Administrador
        ? -1
        : b.nombre === Permiso.Administrador
          ? 1
          : nombrePermiso(a.nombre).localeCompare(nombrePermiso(b.nombre)),
    ),
  );

  protected alternar(permiso: string, marcado: boolean): void {
    this.seleccion.update((actual) =>
      marcado ? [...new Set([...actual, permiso])] : actual.filter((p) => p !== permiso),
    );
  }
}

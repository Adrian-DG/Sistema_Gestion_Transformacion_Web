import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AparienciaService } from '../../core/apariencia/apariencia.service';
import { AuthService } from '../../core/auth/auth.service';
import { cumplePermisos } from '../../core/auth/permisos';
import { MENU } from '../../layout/navegacion';
import { EncabezadoPagina } from '../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../shared/ui/icono/icono';

/** Página de inicio. En la fase 1 se agregan los indicadores del tablero. */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, EncabezadoPagina, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-encabezado-pagina
      [seccion]="apariencia.apariencia().nombreInstitucion ?? undefined"
      [titulo]="'Bienvenido, ' + (auth.usuario()?.usuario ?? '')"
      descripcion="Seleccione un módulo para comenzar."
    />

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      @for (modulo of modulos(); track modulo.ruta) {
        <a
          [routerLink]="modulo.ruta"
          class="tarjeta group flex items-start gap-4 p-5 transition hover:border-primario hover:shadow-md"
        >
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-md bg-primario/10 text-primario group-hover:bg-primario group-hover:text-primario-contraste"
          >
            <app-icono [nombre]="modulo.icono" [tamano]="22" />
          </span>
          <span>
            <span class="block font-semibold text-slate-900">{{ modulo.titulo }}</span>
            <span class="mt-0.5 block text-sm text-slate-500">{{ modulo.descripcion }}</span>
          </span>
        </a>
      }
    </div>
  `,
})
export class Inicio {
  protected readonly auth = inject(AuthService);
  protected readonly apariencia = inject(AparienciaService);

  protected readonly modulos = computed(() =>
    MENU.flatMap((g) => g.elementos).filter(
      (e) => e.ruta !== '/inicio' && cumplePermisos(this.auth.permisos(), e.permisos),
    ),
  );
}

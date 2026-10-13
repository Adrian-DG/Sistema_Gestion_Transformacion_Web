import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AparienciaService } from '../../core/apariencia/apariencia.service';
import { AuthService } from '../../core/auth/auth.service';
import { cumplePermisos } from '../../core/auth/permisos';
import { DialogosService } from '../../core/dialogos/dialogos.service';
import { Icono } from '../../shared/ui/icono/icono';
import { Marca } from '../marca/marca';
import { MENU } from '../navegacion';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono, Marca],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  host: {
    class: 'flex min-h-dvh flex-col',
    '(document:click)': 'cerrarMenuUsuarioSiFuera($event)',
    '(document:keydown.escape)': 'menuUsuarioAbierto.set(false); menuLateralAbierto.set(false)',
  },
})
export class Shell {
  protected readonly apariencia = inject(AparienciaService);
  protected readonly auth = inject(AuthService);
  private readonly dialogos = inject(DialogosService);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly menuLateralAbierto = signal(false);
  protected readonly menuUsuarioAbierto = signal(false);
  protected readonly anio = new Date().getFullYear();

  /** Solo los grupos y opciones que el usuario puede usar. */
  protected readonly menu = computed(() => {
    const permisos = this.auth.permisos();
    return MENU.map((grupo) => ({
      ...grupo,
      elementos: grupo.elementos.filter((e) => cumplePermisos(permisos, e.permisos)),
    })).filter((grupo) => grupo.elementos.length > 0);
  });

  protected readonly iniciales = computed(() =>
    (this.auth.usuario()?.usuario ?? '?').slice(0, 2).toUpperCase(),
  );

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.menuLateralAbierto.set(false);
        this.menuUsuarioAbierto.set(false);
      });
  }

  protected async cerrarSesion(): Promise<void> {
    this.menuUsuarioAbierto.set(false);
    const confirmado = await this.dialogos.confirmar({
      titulo: 'Cerrar sesión',
      mensaje: '¿Desea salir del sistema?',
      textoConfirmar: 'Cerrar sesión',
    });
    if (confirmado) this.auth.cerrarSesion();
  }

  protected cerrarMenuUsuarioSiFuera(evento: Event): void {
    if (!this.menuUsuarioAbierto()) return;
    const menu = this.elemento.nativeElement.querySelector('[data-menu-usuario]');
    if (menu && !menu.contains(evento.target as Node)) this.menuUsuarioAbierto.set(false);
  }
}

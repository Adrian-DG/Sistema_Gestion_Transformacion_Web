import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { AparienciaService } from './apariencia/apariencia.service';

/**
 * Título de la pestaña: "Página · Nombre del sistema". Se actualiza también cuando cambia el
 * nombre del sistema (ej. al sincronizar la apariencia después de la primera navegación).
 */
@Injectable({ providedIn: 'root' })
export class TituloPaginas extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly apariencia = inject(AparienciaService);
  private readonly pagina = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const pagina = this.pagina();
      const sistema = this.apariencia.nombreCorto();
      this.title.setTitle(pagina ? `${pagina} · ${sistema}` : sistema);
    });
  }

  override updateTitle(estado: RouterStateSnapshot): void {
    this.pagina.set(this.buildTitle(estado));
  }
}

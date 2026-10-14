import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { AparienciaService } from '../../../core/apariencia/apariencia.service';
import { DialogosService } from '../../../core/dialogos/dialogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { EstadoVacio } from '../../../shared/ui/estado-vacio/estado-vacio';
import { Icono } from '../../../shared/ui/icono/icono';
import { AparienciaDetalle, AparienciasService } from '../apariencias.service';
import { VistaPreviaApariencia } from '../vista-previa/vista-previa-apariencia';

/**
 * Apariencias guardadas. Solo una está activa (la que ven todos los usuarios); las demás se conservan
 * para volver a usarlas. No se eliminan.
 */
@Component({
  selector: 'app-apariencias-lista',
  imports: [
    DatePipe,
    RouterLink,
    EncabezadoPagina,
    EstadoBadge,
    EstadoVacio,
    Cargando,
    Icono,
    VistaPreviaApariencia,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './apariencias-lista.html',
})
export class AparienciasLista {
  private readonly apariencias = inject(AparienciasService);
  private readonly aparienciaActiva = inject(AparienciaService);
  private readonly dialogos = inject(DialogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  protected readonly filas = signal<AparienciaDetalle[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly procesando = signal<string | null>(null);

  /** URL local (blob) del logo de cada apariencia que tiene uno. */
  protected readonly logos = signal<Record<string, string>>({});

  private readonly recargar = signal(0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.liberarLogos());

    toObservable(this.recargar)
      .pipe(
        tap(() => this.cargando.set(true)),
        switchMap(() =>
          this.apariencias.listar().pipe(
            catchError(() => {
              this.error.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((apariencias) => {
        if (apariencias) {
          this.filas.set(apariencias);
          this.error.set(false);
          void this.cargarLogos(apariencias);
        }
        this.cargando.set(false);
      });
  }

  protected async activar(apariencia: AparienciaDetalle): Promise<void> {
    const confirmado = await this.dialogos.confirmar({
      titulo: 'Activar apariencia',
      mensaje: `Todos los usuarios verán "${apariencia.nombre}". La apariencia activa actual quedará guardada para usarla después.`,
      textoConfirmar: 'Activar',
    });
    if (!confirmado) return;

    this.procesando.set(apariencia.id);
    try {
      await firstValueFrom(this.apariencias.activar(apariencia.id));
      await this.aparienciaActiva.refrescar();
      this.notificaciones.exito(`"${apariencia.nombre}" es ahora la apariencia del sistema.`);
      this.recargar.update((n) => n + 1);
    } catch (e) {
      if (!esApiError(e)) throw e;
    } finally {
      this.procesando.set(null);
    }
  }

  protected async duplicar(apariencia: AparienciaDetalle): Promise<void> {
    const nombre = await this.dialogos.solicitarMotivo({
      titulo: 'Duplicar apariencia',
      mensaje: `Se copiarán los textos, colores y logo de "${apariencia.nombre}". La copia queda inactiva para que pueda editarla.`,
      textoConfirmar: 'Duplicar',
      motivo: { etiqueta: 'Nombre de la copia', maximo: 100 },
    });
    if (!nombre) return;

    this.procesando.set(apariencia.id);
    try {
      const id = await firstValueFrom(this.apariencias.duplicar(apariencia.id, nombre.trim()));
      this.notificaciones.exito('Apariencia duplicada.');
      await this.router.navigate(['/apariencia', id, 'editar']);
    } catch (e) {
      if (!esApiError(e)) throw e;
    } finally {
      this.procesando.set(null);
    }
  }

  private async cargarLogos(apariencias: AparienciaDetalle[]): Promise<void> {
    this.liberarLogos();
    const logos: Record<string, string> = {};
    await Promise.all(
      apariencias
        .filter((a) => a.tieneLogo)
        .map(async (a) => {
          try {
            logos[a.id] = URL.createObjectURL(await firstValueFrom(this.apariencias.logo(a.id)));
          } catch {
            // Sin logo en la vista previa; la apariencia se muestra igual.
          }
        }),
    );
    this.logos.set(logos);
  }

  private liberarLogos(): void {
    Object.values(this.logos()).forEach((url) => URL.revokeObjectURL(url));
    this.logos.set({});
  }
}
